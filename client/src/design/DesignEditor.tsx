import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, type ReactNode, Component, type ErrorInfo, createContext, useContext } from "react";
import { partitionSelection, alignArtboardsInState, distributeArtboardsInState, pasteArtboardsInState, type AlignEdge, type DistributeAxis } from "./artboardAlignment";
import { _multiSelRef, publishMultiSelection, useMultiSelectionIds } from "./multiSelectStore";
import { Editor, Frame, Element, useEditor, DefaultEventHandlers } from "@craftjs/core";
import { Trash2, Search, X, Loader2, AlertCircle, ZoomIn, ZoomOut, Maximize2, ArrowUp, Layers, Square, Type, AlignLeft, LayoutTemplate, Minus, ToggleLeft, ChevronRight, ChevronLeft, ChevronDown, StickyNote, ListTree, Sparkles, MessageCirclePlus, Upload, ImagePlus, LayoutGrid, LayoutList, AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignHorizontalSpaceBetween, AlignHorizontalSpaceAround, AlignVerticalSpaceBetween, AlignVerticalSpaceAround, StretchHorizontal, StretchVertical, WrapText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  readDesignChat,
  saveDesignChat,
  subscribeDesignChat,
  adoptPendingDesignTranscript,
  type TranscriptEntry,
  type DesignPreview,
} from "@/lib/kiteaiTranscript";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  resolver,
  AstryxSection,
  AstryxStack,
  AstryxHStack,
  AstryxArtboard,
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
  AstryxNavbar,
  AstryxSidebar,
  AstryxBreadcrumb,
  AstryxModal,
  AstryxDrawer,
  AstryxSheet,
  AstryxBarChart,
  AstryxLineChart,
  AstryxPieChart,
  AstryxVideoPlayer,
  AstryxCodeBlock,
  AstryxList,
  AstryxListItem,
  AstryxField,
  AstryxFieldStatus,
  AstryxFormLayout,
  AstryxInputGroup,
  AstryxGrid,
  AstryxTextArea,
  AstryxSwitch,
  AstryxNumberInput,
  AstryxToggleButton,
  AstryxSegmentedControl,
  AstryxCheckboxList,
  AstryxIconButton,
  createEmptyCraftState,
  sanitizeCraftState,
  validateCraftState,
  CanvasZoomContext,
  SnapGuideContext,
} from "./resolver";
import {
  repairCraftState,
  repairCraftStateWithReport,
  suggestAlternativeComponent,
  type CraftRepairReport,
} from "./craftValidator";
import { detectNewScreenIntent } from "./newScreenIntent";
import { ImportDesignModal } from "./ImportDesignModal";
import { skeletonizeCraftState } from "./lib/craftStateSkeleton";
import { applyContrastColors, contrastTextFor } from "./lib/contrastColor";
import { applyEqualWidthProps, applyEqualHeightProps, clearFlexSizingProps, getEqualWidthSelectionResult, getEqualHeightSelectionResult } from "./layoutSizing";
import { useToast } from "@/hooks/use-toast";
import {
  AstryxButton as AstryxButtonBase,
  AstryxCard as AstryxCardBase,
  AstryxText as AstryxTextBase,
  AstryxHeading as AstryxHeadingBase,
  AstryxTextInput as AstryxTextInputBase,
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
  AstryxIcon as AstryxIconBase,
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
  AstryxNavbar as AstryxNavbarBase,
  AstryxSidebar as AstryxSidebarBase,
  AstryxBreadcrumb as AstryxBreadcrumbBase,
  AstryxModal as AstryxModalBase,
  AstryxDrawer as AstryxDrawerBase,
  AstryxSheet as AstryxSheetBase,
  AstryxBarChart as AstryxBarChartBase,
  AstryxLineChart as AstryxLineChartBase,
  AstryxPieChart as AstryxPieChartBase,
  AstryxVideoPlayer as AstryxVideoPlayerBase,
  AstryxCodeBlock as AstryxCodeBlockBase,
  AstryxList as AstryxListBase,
  AstryxListItem as AstryxListItemBase,
  AstryxFieldStatus as AstryxFieldStatusBase,
  AstryxTextArea as AstryxTextAreaBase,
  AstryxSwitch as AstryxSwitchBase,
  AstryxNumberInput as AstryxNumberInputBase,
  AstryxToggleButton as AstryxToggleButtonBase,
  AstryxSegmentedControl as AstryxSegmentedControlBase,
  AstryxCheckboxList as AstryxCheckboxListBase,
  AstryxIconButton as AstryxIconButtonBase,
  ICON_GLYPHS,
} from "@/components/astryx";

// ─── Preview error boundary ────────────────────────────────────────────────────

class PreviewErrorBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) { /* silent */ }
  render() {
    if (this.state.failed) {
      return (
        <span className="text-[9px] text-muted-foreground/60 italic">{this.props.name}</span>
      );
    }
    return this.props.children;
  }
}

// ─── Preview thumbnail wrapper ────────────────────────────────────────────────

function PreviewThumbnail({ name, children }: { name: string; children: ReactNode }) {
  return (
    <PreviewErrorBoundary name={name}>
      <div
        className="w-full h-[52px] overflow-hidden flex items-center justify-center"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{ transform: "scale(0.65)", transformOrigin: "center center", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children}
        </div>
      </div>
    </PreviewErrorBoundary>
  );
}

// ─── SaveWatcher ──────────────────────────────────────────────────────────────

interface SaveWatcherProps {
  /** Called by the 800 ms debounce — normal in-session save. */
  onSave: (state: string) => void;
  /**
   * Called only from the `beforeunload` flush.  Use a keepalive/sendBeacon
   * transport here so the request is not cancelled when the page navigates.
   * Falls back to `onSave` when not provided.
   */
  onBeforeUnloadSave?: (state: string) => void;
}

function SaveWatcher({ onSave, onBeforeUnloadSave }: SaveWatcherProps) {
  const { query, store } = useEditor(() => ({}));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);
  const pendingSave = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onBeforeUnloadSaveRef = useRef(onBeforeUnloadSave);
  onBeforeUnloadSaveRef.current = onBeforeUnloadSave;

  useEffect(() => {
    const unsub = (store as unknown as { subscribe: (cb: () => void) => () => void }).subscribe(() => {
      if (!savedOnce.current) { savedOnce.current = true; return; }
      if (timerRef.current) clearTimeout(timerRef.current);
      let serialized: string | null = null;
      try { serialized = query.serialize(); } catch { /* ignore */ }
      pendingSave.current = serialized;
      if (serialized) {
        timerRef.current = setTimeout(() => {
          if (pendingSave.current) {
            try { onSaveRef.current(pendingSave.current); } catch { /* ignore */ }
            pendingSave.current = null;
          }
        }, 800);
      }
    });

    // Called when the page is about to unload.  Uses the keepalive transport
    // so the request completes even after the browser navigates away.
    const handleBeforeUnload = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingSave.current) {
        const state = pendingSave.current;
        pendingSave.current = null;
        try {
          const flushFn = onBeforeUnloadSaveRef.current ?? onSaveRef.current;
          flushFn(state);
        } catch { /* ignore */ }
      }
    };

    // Called when the component unmounts (tab hidden, editor closed).
    // Prefer the keepalive transport (same as beforeunload) so that a fast
    // navigation — e.g. switching to the home screen before the 800 ms debounce
    // fires — doesn't silently drop a pending craft-state save.
    const flushOnUnmount = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingSave.current) {
        const state = pendingSave.current;
        pendingSave.current = null;
        try {
          const flushFn = onBeforeUnloadSaveRef.current ?? onSaveRef.current;
          flushFn(state);
        } catch { /* ignore */ }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      flushOnUnmount();
      unsub();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [query, store]);

  return null;
}

// ─── Toolbox data ─────────────────────────────────────────────────────────────

interface ToolboxItem {
  name: string;
  description: string;
  getElement: () => JSX.Element;
  preview: JSX.Element;
}

interface ToolboxCategory {
  name: string;
  items: ToolboxItem[];
}

const TOOLBOX_CATEGORIES: ToolboxCategory[] = [
  {
    name: "Layout",
    items: [
      {
        name: "Section",  description: "Flex container",
        getElement: () => <Element canvas is={AstryxSection} direction="column" gap={16} padding={16} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 110, padding: 6, border: "1px dashed hsl(var(--border))", borderRadius: 6, background: "hsl(var(--muted))" }}>
            <div style={{ height: 8, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 8, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 8, background: "hsl(var(--border))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "Stack",    description: "Vertical stack",
        getElement: () => <Element canvas is={AstryxStack} gap={8} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 80 }}>
            <div style={{ height: 9, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 9, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 9, background: "hsl(var(--border))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "HStack",   description: "Horizontal stack",
        getElement: () => <Element canvas is={AstryxHStack} gap={8} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "row", gap: 4, alignItems: "center" }}>
            <div style={{ width: 28, height: 12, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ width: 28, height: 12, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ width: 28, height: 12, background: "hsl(var(--border))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "Grid",     description: "Equal-column grid",
        getElement: () => <Element canvas is={AstryxGrid} columns={2} gap={12} />,
        preview: (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, width: 80 }}>
            <div style={{ height: 14, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 14, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 14, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 14, background: "hsl(var(--border))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "Resizable", description: "Split panels",
        getElement: () => <AstryxResizable direction="horizontal" />,
        preview: <AstryxResizableBase direction="horizontal" />,
      },
    ],
  },
  {
    name: "Forms",
    items: [
      {
        name: "FormLayout", description: "Form field grid",
        getElement: () => <Element canvas is={AstryxFormLayout} columns={1} gap={16} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 96 }}>
            <div style={{ height: 5, width: 34, background: "hsl(var(--border))", borderRadius: 2 }} />
            <div style={{ height: 11, background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 5, width: 28, background: "hsl(var(--border))", borderRadius: 2 }} />
            <div style={{ height: 11, background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "Field",      description: "Labelled field wrapper",
        getElement: () => (
          <Element canvas is={AstryxField} label="Email address" helpText="We'll never share it.">
            <AstryxTextInput placeholder="you@company.com" />
          </Element>
        ),
        preview: (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 96 }}>
            <div style={{ height: 5, width: 40, background: "hsl(var(--border))", borderRadius: 2 }} />
            <div style={{ height: 13, background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 4, width: 60, background: "hsl(var(--border))", borderRadius: 2, opacity: 0.6 }} />
          </div>
        ),
      },
      {
        name: "InputGroup", description: "Joined input row",
        getElement: () => (
          <Element canvas is={AstryxInputGroup} gap={0}>
            <AstryxTextInput placeholder="Search…" />
            <AstryxButton variant="primary" size="md">Go</AstryxButton>
          </Element>
        ),
        preview: (
          <div style={{ display: "flex", flexDirection: "row", width: 96 }}>
            <div style={{ flex: 1, height: 14, background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", borderRadius: "3px 0 0 3px" }} />
            <div style={{ width: 26, height: 14, background: "hsl(var(--border))", borderRadius: "0 3px 3px 0" }} />
          </div>
        ),
      },
      {
        name: "FieldStatus", description: "Validation message",
        getElement: () => (
          <Element canvas is={AstryxFieldStatus} status="error">
            <AstryxText size="xs">Enter a valid email address</AstryxText>
          </Element>
        ),
        preview: <AstryxFieldStatusBase status="error">Enter a valid email address</AstryxFieldStatusBase>,
      },
    ],
  },
  {
    name: "Typography",
    items: [
      {
        name: "Heading",  description: "Bold heading",
        getElement: () => <AstryxHeading size="lg">Heading</AstryxHeading>,
        preview: <AstryxHeadingBase size="lg">Heading</AstryxHeadingBase>,
      },
      {
        name: "Text",     description: "Body copy",
        getElement: () => <AstryxText size="md">Text</AstryxText>,
        preview: <AstryxTextBase size="md">Sample text</AstryxTextBase>,
      },
    ],
  },
  {
    name: "Controls",
    items: [
      {
        name: "Button",     description: "Action button",
        getElement: () => <AstryxButton variant="primary" size="md">Button</AstryxButton>,
        preview: <AstryxButtonBase variant="primary" size="md">Button</AstryxButtonBase>,
      },
      {
        name: "TextInput",  description: "Input field",
        getElement: () => <AstryxTextInput placeholder="Enter text…" />,
        preview: <AstryxTextInputBase placeholder="Enter text…" />,
      },
      {
        name: "Select",     description: "Dropdown",
        getElement: () => <AstryxSelect placeholder="Select…" />,
        preview: <AstryxSelectBase placeholder="Select…" />,
      },
      {
        name: "Checkbox",   description: "Checkbox",
        getElement: () => <AstryxCheckbox label="Option" />,
        preview: <AstryxCheckboxBase label="Option" />,
      },
      {
        name: "RadioGroup", description: "Radio buttons",
        getElement: () => <AstryxRadioGroup options="A,B,C" selected="A" />,
        preview: <AstryxRadioGroupBase options="A,B" selected="A" />,
      },
      {
        name: "Slider",     description: "Range slider",
        getElement: () => <AstryxSlider value={50} />,
        preview: <AstryxSliderBase value={50} />,
      },
      {
        name: "TextArea",   description: "Multi-line text",
        getElement: () => <AstryxTextArea placeholder="Write a message…" rows={4} />,
        preview: <AstryxTextAreaBase placeholder="Write a message…" rows={2} />,
      },
      {
        name: "NumberInput", description: "Stepper field",
        getElement: () => <AstryxNumberInput value={1} min={0} />,
        preview: <AstryxNumberInputBase value={1} min={0} />,
      },
      {
        name: "Switch",     description: "On/off toggle",
        getElement: () => <AstryxSwitch label="Enable notifications" checked />,
        preview: <AstryxSwitchBase label="Enabled" checked />,
      },
      {
        name: "ToggleButton", description: "Toggleable button",
        getElement: () => <AstryxToggleButton pressed size="md">Bold</AstryxToggleButton>,
        preview: <AstryxToggleButtonBase pressed size="sm">Bold</AstryxToggleButtonBase>,
      },
      {
        name: "SegmentedControl", description: "Segmented picker",
        getElement: () => <AstryxSegmentedControl options="Day,Week,Month" selected="Week" />,
        preview: <AstryxSegmentedControlBase options="Day,Week" selected="Day" size="sm" />,
      },
      {
        name: "CheckboxList", description: "Multi-select list",
        getElement: () => <AstryxCheckboxList options="Email,SMS,Push" selected="Email" />,
        preview: <AstryxCheckboxListBase options="Email,SMS" selected="Email" />,
      },
      {
        name: "IconButton", description: "Icon-only button",
        getElement: () => <AstryxIconButton name="search" variant="outline" size="md" />,
        preview: <AstryxIconButtonBase name="search" variant="outline" size="md" />,
      },
    ],
  },
  {
    name: "Data",
    items: [
      {
        name: "Table",     description: "Data table",
        getElement: () => <AstryxTable rows={3} columns={3} />,
        preview: <AstryxTableBase rows={2} columns={3} />,
      },
      {
        name: "Tabs",      description: "Tab bar",
        getElement: () => <AstryxTabs tabs="Tab 1,Tab 2,Tab 3" active="Tab 1" />,
        preview: <AstryxTabsBase tabs="Tab 1,Tab 2" active="Tab 1" />,
      },
      {
        name: "Accordion", description: "Collapsible",
        getElement: () => <AstryxAccordion items="Section 1,Section 2,Section 3" open="Section 1" />,
        preview: <AstryxAccordionBase items="Section 1,Section 2" open="Section 1" />,
      },
      {
        name: "Calendar",  description: "Date picker",
        getElement: () => <AstryxCalendar month="July 2026" />,
        preview: <AstryxCalendarBase month="July 2026" />,
      },
      {
        name: "Command",   description: "Search palette",
        getElement: () => <AstryxCommand placeholder="Search commands…" />,
        preview: <AstryxCommandBase placeholder="Search…" />,
      },
      {
        name: "Carousel",  description: "Slide viewer",
        getElement: () => <AstryxCarousel slides="Slide 1,Slide 2,Slide 3" />,
        preview: <AstryxCarouselBase slides="Slide 1,Slide 2" />,
      },
    ],
  },
  {
    name: "Display",
    items: [
      {
        name: "Card",        description: "Elevated box",
        getElement: () => <Element canvas is={AstryxCard} variant="elevated" gap={12} />,
        preview: (
          <div style={{ width: 100, padding: "8px 10px", background: "hsl(var(--card))", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.12)", border: "1px solid hsl(var(--border))" }}>
            <div style={{ height: 7, width: "70%", background: "hsl(var(--border))", borderRadius: 3, marginBottom: 5 }} />
            <div style={{ height: 5, width: "90%", background: "hsl(var(--muted))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "Badge",       description: "Colour label",
        getElement: () => <AstryxBadge color="blue">Badge</AstryxBadge>,
        preview: <AstryxBadgeBase color="blue">Badge</AstryxBadgeBase>,
      },
      {
        name: "Avatar",      description: "User avatar",
        getElement: () => <AstryxAvatar name="AB" size="md" />,
        preview: <AstryxAvatarBase name="AB" size="md" />,
      },
      {
        name: "ProgressBar", description: "Progress bar",
        getElement: () => <AstryxProgressBar value={50} color="blue" />,
        preview: <AstryxProgressBarBase value={60} color="blue" />,
      },
      {
        name: "StatusDot",   description: "Status indicator",
        getElement: () => <AstryxStatusDot status="online" />,
        preview: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AstryxStatusDotBase status="online" />
            <span style={{ fontSize: 11, color: "#6b7280" }}>Online</span>
          </div>
        ),
      },
      {
        name: "Skeleton",    description: "Loading skeleton",
        getElement: () => <AstryxSkeleton width={120} height={16} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <AstryxSkeletonBase width={90} height={10} />
            <AstryxSkeletonBase width={60} height={10} />
          </div>
        ),
      },
    ],
  },
  {
    name: "Feedback",
    items: [
      {
        name: "Banner",     description: "Alert banner",
        getElement: () => <AstryxBanner variant="info">Message</AstryxBanner>,
        preview: <AstryxBannerBase variant="info">Info banner</AstryxBannerBase>,
      },
      {
        name: "Spinner",    description: "Loading spinner",
        getElement: () => <AstryxSpinner size="md" />,
        preview: <AstryxSpinnerBase size="md" />,
      },
      {
        name: "EmptyState", description: "Empty state",
        getElement: () => <AstryxEmptyState title="Nothing here" />,
        preview: <AstryxEmptyStateBase title="Nothing here" />,
      },
    ],
  },
  {
    name: "Content",
    items: [
      {
        name: "Divider",     description: "Horizontal rule",
        getElement: () => <AstryxDivider />,
        preview: <AstryxDividerBase />,
      },
      {
        name: "ChatMessage", description: "Chat bubble",
        getElement: () => <AstryxChatMessage sender="User">Hello!</AstryxChatMessage>,
        preview: <AstryxChatMessageBase sender="User">Hello!</AstryxChatMessageBase>,
      },
      {
        name: "Token",       description: "Tag / chip",
        getElement: () => <AstryxToken>Tag</AstryxToken>,
        preview: <AstryxTokenBase>Tag</AstryxTokenBase>,
      },
      {
        name: "Icon",        description: "Icon placeholder",
        getElement: () => <AstryxIcon size="md" />,
        preview: <AstryxIconBase size="md" />,
      },
      {
        name: "VideoPlayer", description: "Video embed",
        getElement: () => <AstryxVideoPlayer title="Video" />,
        preview: <AstryxVideoPlayerBase title="Video" duration="2:30" />,
      },
      {
        name: "CodeBlock",   description: "Code snippet",
        getElement: () => <AstryxCodeBlock language="javascript" />,
        preview: <AstryxCodeBlockBase language="js" code="const x = 1;" />,
      },
    ],
  },
  {
    name: "Navigation",
    items: [
      {
        name: "Navbar",      description: "Top navigation bar",
        getElement: () => <AstryxNavbar logo="App" links="Home,About,Pricing" />,
        preview: <AstryxNavbarBase logo="App" links="Home,About" actions="Sign In" />,
      },
      {
        name: "Sidebar",     description: "Side navigation",
        getElement: () => <AstryxSidebar logo="App" items="Dashboard,Analytics,Settings" active="Dashboard" />,
        preview: <AstryxSidebarBase logo="App" items="Dashboard,Analytics,Settings" active="Dashboard" />,
      },
      {
        name: "Breadcrumb",  description: "Page breadcrumb",
        getElement: () => <AstryxBreadcrumb items="Home,Section,Page" />,
        preview: <AstryxBreadcrumbBase items="Home,Section,Page" />,
      },
    ],
  },
  {
    name: "Overlays",
    items: [
      {
        name: "Modal",  description: "Dialog modal",
        getElement: () => <AstryxModal title="Confirm" confirmLabel="OK" cancelLabel="Cancel" />,
        preview: <AstryxModalBase title="Confirm" description="Are you sure?" confirmLabel="OK" cancelLabel="Cancel" />,
      },
      {
        name: "Drawer", description: "Side drawer",
        getElement: () => <AstryxDrawer title="Drawer" side="right" />,
        preview: <AstryxDrawerBase title="Drawer" side="right" description="Content here." />,
      },
      {
        name: "Sheet",  description: "Bottom sheet",
        getElement: () => <AstryxSheet title="Sheet" side="bottom" />,
        preview: <AstryxSheetBase title="Sheet" side="bottom" description="Content here." />,
      },
    ],
  },
  {
    name: "Charts",
    items: [
      {
        name: "BarChart",  description: "Bar chart",
        getElement: () => <AstryxBarChart data="Jan:80,Feb:120,Mar:95,Apr:140" color="blue" />,
        preview: <AstryxBarChartBase data="A:80,B:120,C:95,D:140" color="blue" />,
      },
      {
        name: "LineChart", description: "Line chart",
        getElement: () => <AstryxLineChart data="Jan:80,Feb:120,Mar:95,Apr:140" color="blue" />,
        preview: <AstryxLineChartBase data="A:80,B:120,C:95,D:140" color="blue" />,
      },
      {
        name: "PieChart",  description: "Pie / donut chart",
        getElement: () => <AstryxPieChart data="A:40,B:30,C:20,D:10" />,
        preview: <AstryxPieChartBase data="A:40,B:30,C:30" />,
      },
    ],
  },
  {
    name: "Lists",
    items: [
      {
        name: "List",     description: "List container",
        getElement: () => <Element canvas is={AstryxList} divided />,
        preview: (
          <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, overflow: "hidden", width: 110 }}>
            {["Item A", "Item B", "Item C"].map((t, i) => (
              <div key={i} style={{ padding: "4px 8px", fontSize: 10, borderBottom: i < 2 ? "1px solid hsl(var(--border))" : undefined, color: "hsl(var(--foreground))" }}>{t}</div>
            ))}
          </div>
        ),
      },
      {
        name: "ListItem", description: "List row",
        getElement: () => <AstryxListItem label="List item" />,
        preview: <AstryxListItemBase label="List item" description="Supporting text" />,
      },
    ],
  },
];

// ─── Draggable tile ───────────────────────────────────────────────────────────

function DraggableItem({ item, connectors }: { item: ToolboxItem; connectors: any }) {
  return (
    <div
      ref={(ref) => { if (ref) connectors.create(ref, item.getElement()); }}
      title={item.description}
      className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-background hover:bg-primary/5 border border-border hover:border-primary/30 cursor-grab active:cursor-grabbing transition-all group shadow-sm hover:shadow-md select-none"
    >
      <div className="w-full rounded-lg border border-border group-hover:border-primary/20 overflow-hidden bg-muted/20">
        <PreviewThumbnail name={item.name}>
          {item.preview}
        </PreviewThumbnail>
      </div>
      <span className="text-[9.5px] text-muted-foreground group-hover:text-primary font-medium leading-none">{item.name}</span>
    </div>
  );
}

// ─── Draggable list-row (used in list view) ────────────────────────────────────

function DraggableListItem({ item, connectors }: { item: ToolboxItem; connectors: any }) {
  return (
    <div
      ref={(ref) => { if (ref) connectors.create(ref, item.getElement()); }}
      title={item.description}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/20 cursor-grab active:cursor-grabbing transition-all group select-none"
    >
      {/* Miniature preview thumbnail */}
      <div className="w-10 h-7 shrink-0 rounded border border-border/60 bg-muted/30 overflow-hidden flex items-center justify-center" style={{ pointerEvents: "none" }}>
        <PreviewErrorBoundary name={item.name}>
          <div style={{ transform: "scale(0.38)", transformOrigin: "center center", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", userSelect: "none" }}>
            {item.preview}
          </div>
        </PreviewErrorBoundary>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] font-medium text-foreground group-hover:text-primary leading-tight truncate">{item.name}</div>
        <div className="text-[9px] text-muted-foreground/70 leading-tight truncate">{item.description}</div>
      </div>
    </div>
  );
}

// ─── Prop helpers ─────────────────────────────────────────────────────────────

function PropRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function TextProp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumberProp({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function SelectProp({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      value={value ?? options[0]}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ToggleProp({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-8 h-4 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted-foreground/30"} relative`}
    >
      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

type LayoutOption = {
  value: string;
  label: string;
  icon: ReactNode;
};

function LayoutIconGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: LayoutOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-1" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          aria-label={option.label}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 h-7 rounded-md border flex items-center justify-center transition-all ${
            value === option.value
              ? "bg-foreground border-foreground text-background shadow-sm"
              : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground bg-background"
          }`}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

const ICON_ENTRIES = Object.entries(ICON_GLYPHS);

function IconPickerProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const currentGlyph = ICON_GLYPHS[value.toLowerCase().trim()] ?? (value.charAt(0).toUpperCase() || "⬡");
  const filtered = search.trim()
    ? ICON_ENTRIES.filter(([name]) => name.includes(search.toLowerCase()))
    : ICON_ENTRIES;
  return (
    <div className="flex items-center gap-2 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted transition-colors"
            title="Browse icons"
          >
            <span className="text-base leading-none">{currentGlyph}</span>
            <span className="text-muted-foreground">{value || "star"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <input
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search icons…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
            {filtered.map(([name, glyph]) => (
              <button
                key={name}
                title={name}
                onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                className={`flex flex-col items-center justify-center rounded p-1.5 text-center hover:bg-muted transition-colors ${value === name ? "bg-primary/10 ring-1 ring-primary" : ""}`}
              >
                <span className="text-base leading-none">{glyph}</span>
                <span className="text-[8px] text-muted-foreground truncate w-full text-center mt-0.5">{name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <input
        className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        value={value}
        placeholder="custom name"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Component-specific props ─────────────────────────────────────────────────

const BG_SWATCHES = ["#ffffff","#f8fafc","#1e293b","#0f172a","#000000","#3b82f6","#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];

function ArtboardBackgroundPicker({ props, setProp }: { props: Record<string, any>; setProp: (k: string, v: any) => void }) {
  const activeType: "color" | "gradient" | "image" = props.backgroundType ?? "color";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState<string>(props.backgroundImageUrl ?? "");

  const grad1 = props._gradStop1 ?? "#3b82f6";
  const grad2 = props._gradStop2 ?? "#8b5cf6";
  const gradAngle = props._gradAngle ?? 135;
  const updateGradient = (stop1: string, stop2: string, angle: number) => {
    setProp("_gradStop1", stop1);
    setProp("_gradStop2", stop2);
    setProp("_gradAngle", angle);
    setProp("backgroundGradient", `linear-gradient(${angle}deg, ${stop1}, ${stop2})`);
  };

  const switchType = (t: "color" | "gradient" | "image") => {
    setProp("backgroundType", t);
    if (t === "gradient") {
      updateGradient(grad1, grad2, gradAngle);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) { setProp("backgroundImageUrl", url); setUrlInput(""); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const applyUrl = () => {
    const trimmed = urlInput.trim();
    if (trimmed) { setProp("backgroundImageUrl", trimmed); }
  };

  const pill = (t: "color" | "gradient" | "image", label: string) => (
    <button
      onClick={() => switchType(t)}
      className={`flex-1 py-0.5 text-[10px] font-medium rounded transition-colors ${
        activeType === t
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <PropRow label="Background">
      <div className="flex gap-0.5 rounded-md border border-border p-0.5 mb-2">
        {pill("color", "Color")}
        {pill("gradient", "Gradient")}
        {pill("image", "Image")}
      </div>

      {activeType === "color" && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setProp("backgroundColor", undefined)}
            title="Default"
            style={{
              backgroundImage: "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
              backgroundSize: "6px 6px",
              backgroundPosition: "0 0,0 3px,3px -3px,-3px 0px",
              backgroundColor: "#fff",
              boxShadow: !props.backgroundColor
                ? "0 0 0 2px hsl(var(--background)), 0 0 0 3.5px #3b82f6"
                : undefined,
            }}
            className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
          />
          {BG_SWATCHES.map((hex) => (
            <button
              key={hex}
              onClick={() => setProp("backgroundColor", hex)}
              title={hex}
              style={{
                background: hex,
                boxShadow: props.backgroundColor === hex
                  ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                  : undefined,
              }}
              className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
            />
          ))}
          <input
            type="color"
            value={props.backgroundColor && props.backgroundColor !== "transparent" ? props.backgroundColor : "#ffffff"}
            onChange={(e) => setProp("backgroundColor", e.target.value)}
            title="Custom color"
            className="w-5 h-5 rounded-md border border-black/10 cursor-pointer flex-shrink-0 p-0"
            style={{ appearance: "none", padding: 0 }}
          />
        </div>
      )}

      {activeType === "gradient" && (
        <div className="flex flex-col gap-2">
          <div
            className="w-full h-8 rounded-md border border-border"
            style={{ background: `linear-gradient(${gradAngle}deg, ${grad1}, ${grad2})` }}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 flex-shrink-0">Stop 1</span>
            <input type="color" value={grad1} onChange={(e) => updateGradient(e.target.value, grad2, gradAngle)}
              className="w-6 h-5 rounded border border-black/10 cursor-pointer flex-shrink-0 p-0" />
            <span className="text-[10px] font-mono text-muted-foreground">{grad1}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 flex-shrink-0">Stop 2</span>
            <input type="color" value={grad2} onChange={(e) => updateGradient(grad1, e.target.value, gradAngle)}
              className="w-6 h-5 rounded border border-black/10 cursor-pointer flex-shrink-0 p-0" />
            <span className="text-[10px] font-mono text-muted-foreground">{grad2}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 flex-shrink-0">Angle</span>
            <input
              type="range" min={0} max={360} value={gradAngle}
              onChange={(e) => updateGradient(grad1, grad2, Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{gradAngle}°</span>
          </div>
        </div>
      )}

      {activeType === "image" && (
        <div className="flex flex-col gap-2">
          {props.backgroundImageUrl ? (
            <>
              <div className="relative w-full h-16 rounded-md border border-border overflow-hidden">
                <img src={props.backgroundImageUrl} alt="bg" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setProp("backgroundImageUrl", undefined); setUrlInput(""); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] flex items-center justify-center hover:bg-black/80 transition-colors"
                  title="Remove image"
                >×</button>
              </div>
            </>
          ) : (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 text-[10px] rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                ↑ Upload image
              </button>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyUrl(); }}
                  placeholder="Paste image URL…"
                  className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={applyUrl}
                  className="px-2 py-1 text-[10px] rounded border border-border bg-muted hover:bg-accent transition-colors flex-shrink-0"
                >Use</button>
              </div>
            </>
          )}
        </div>
      )}
    </PropRow>
  );
}

function ComponentProps({ displayName, props, setProp }: { displayName: string; props: Record<string, any>; setProp: (k: string, v: any) => void }) {
  if (displayName === "AstryxHeading") return (
    <>
      <PropRow label="Content"><TextProp value={props.children ?? "Heading"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "lg"} options={["sm","md","lg","xl","2xl"]} onChange={(v) => setProp("size", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxText") return (
    <>
      <PropRow label="Content"><TextProp value={props.children ?? "Text"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["xs","sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
      <PropRow label="Muted">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.muted} onChange={(v) => setProp("muted", v)} />
          <span className="text-xs text-muted-foreground">{props.muted ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxButton") return (
    <>
      <PropRow label="Label"><TextProp value={props.children ?? "Button"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Variant"><SelectProp value={props.variant ?? "primary"} options={["primary","secondary","outline","ghost"]} onChange={(v) => setProp("variant", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxTextInput") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? ""} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Placeholder"><TextProp value={props.placeholder ?? ""} onChange={(v) => setProp("placeholder", v)} /></PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxCard") return (
    <>
      <PropRow label="Variant"><SelectProp value={props.variant ?? "elevated"} options={["elevated","outlined","ghost"]} onChange={(v) => setProp("variant", v)} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 12} onChange={(v) => setProp("gap", Math.max(0, v))} min={0} /></PropRow>
      <PropRow label="Wrap"><LayoutIconGroup value={props.wrap ?? "nowrap"} options={WRAP_OPTIONS} onChange={(v) => setProp("wrap", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxBadge") return (
    <>
      <PropRow label="Label"><TextProp value={props.children ?? "Badge"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Color"><SelectProp value={props.color ?? "blue"} options={["blue","green","amber","red","gray"]} onChange={(v) => setProp("color", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxAvatar") return (
    <>
      <PropRow label="Name"><TextProp value={props.name ?? "?"} onChange={(v) => setProp("name", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["xs","sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxProgressBar") return (
    <>
      <PropRow label="Value (0–100)"><NumberProp value={props.value ?? 50} onChange={(v) => setProp("value", v)} min={0} max={100} /></PropRow>
      <PropRow label="Color"><SelectProp value={props.color ?? "blue"} options={["blue","green","amber","red"]} onChange={(v) => setProp("color", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxStatusDot") return (
    <PropRow label="Status"><SelectProp value={props.status ?? "online"} options={["online","offline","busy","away"]} onChange={(v) => setProp("status", v)} /></PropRow>
  );

  if (displayName === "AstryxBanner") return (
    <>
      <PropRow label="Message"><TextProp value={props.children ?? "Banner message"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Variant"><SelectProp value={props.variant ?? "info"} options={["info","success","warning","error"]} onChange={(v) => setProp("variant", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxSpinner") return (
    <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
  );

  if (displayName === "AstryxEmptyState") return (
    <>
      <PropRow label="Title"><TextProp value={props.title ?? "Nothing here"} onChange={(v) => setProp("title", v)} /></PropRow>
      <PropRow label="Description"><TextProp value={props.description ?? ""} onChange={(v) => setProp("description", v)} /></PropRow>
      <PropRow label="Action label"><TextProp value={props.action ?? ""} onChange={(v) => setProp("action", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxDivider") return (
    <PropRow label="Label"><TextProp value={props.label ?? ""} onChange={(v) => setProp("label", v)} /></PropRow>
  );

  if (displayName === "AstryxChatMessage") return (
    <>
      <PropRow label="Message"><TextProp value={props.children ?? "Hello!"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Sender"><TextProp value={props.sender ?? "User"} onChange={(v) => setProp("sender", v)} /></PropRow>
      <PropRow label="Own message">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.isOwn} onChange={(v) => setProp("isOwn", v)} />
          <span className="text-xs text-muted-foreground">{props.isOwn ? "Yes" : "No"}</span>
        </div>
      </PropRow>
      <PropRow label="Timestamp"><TextProp value={props.timestamp ?? ""} onChange={(v) => setProp("timestamp", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxToken") return (
    <PropRow label="Label"><TextProp value={props.children ?? "Tag"} onChange={(v) => setProp("children", v)} /></PropRow>
  );

  if (displayName === "AstryxIcon") return (
    <>
      <PropRow label="Icon">
        <IconPickerProp value={String(props.name ?? "star")} onChange={(v) => setProp("name", v)} />
      </PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxSelect") return (
    <>
      <PropRow label="Placeholder"><TextProp value={props.placeholder ?? "Select…"} onChange={(v) => setProp("placeholder", v)} /></PropRow>
      <PropRow label="Options (comma-sep)"><TextProp value={props.options ?? "Option A,Option B"} onChange={(v) => setProp("options", v)} /></PropRow>
      <PropRow label="Open">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.open} onChange={(v) => setProp("open", v)} />
          <span className="text-xs text-muted-foreground">{props.open ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxCheckbox") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? "Checkbox"} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Checked">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.checked} onChange={(v) => setProp("checked", v)} />
          <span className="text-xs text-muted-foreground">{props.checked ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxRadioGroup") return (
    <>
      <PropRow label="Options (comma-sep)"><TextProp value={props.options ?? "Option A,Option B"} onChange={(v) => setProp("options", v)} /></PropRow>
      <PropRow label="Selected"><TextProp value={props.selected ?? ""} onChange={(v) => setProp("selected", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxSlider") return (
    <>
      <PropRow label="Value"><NumberProp value={props.value ?? 50} onChange={(v) => setProp("value", v)} min={0} max={100} /></PropRow>
      <PropRow label="Min"><NumberProp value={props.min ?? 0} onChange={(v) => setProp("min", v)} min={0} /></PropRow>
      <PropRow label="Max"><NumberProp value={props.max ?? 100} onChange={(v) => setProp("max", v)} min={1} /></PropRow>
    </>
  );

  if (displayName === "AstryxTable") {
    const handleRowsChange = (v: number) => {
      const nR = Math.min(Math.max(1, v), 10);
      const nC = Math.min(Math.max(1, Number(props.columns ?? 3)), 6);
      const existing = (props.cellData as string[][] | undefined) ?? [];
      const newCellData: string[][] = Array.from({ length: nR }, (_, r) =>
        Array.from({ length: nC }, (_, c) => existing[r]?.[c] ?? "—")
      );
      setProp("rows", nR);
      setProp("cellData", newCellData);
    };
    const handleColsChange = (v: number) => {
      const nR = Math.min(Math.max(1, Number(props.rows ?? 3)), 10);
      const nC = Math.min(Math.max(1, v), 6);
      const existingCells = (props.cellData as string[][] | undefined) ?? [];
      const existingHeaders = (props.headers as string[] | undefined) ?? [];
      const existingColWidths = (props.colWidths as string[] | undefined) ?? [];
      const newCellData: string[][] = Array.from({ length: nR }, (_, r) =>
        Array.from({ length: nC }, (_, c) => existingCells[r]?.[c] ?? "—")
      );
      const newHeaders: string[] = Array.from({ length: nC }, (_, i) =>
        existingHeaders[i] ?? `Col ${i + 1}`
      );
      const newColWidths: string[] = Array.from({ length: nC }, (_, i) =>
        existingColWidths[i] ?? ""
      );
      setProp("columns", nC);
      setProp("cellData", newCellData);
      setProp("headers", newHeaders);
      setProp("colWidths", newColWidths);
    };
    const handleReset = () => {
      const nR = Math.min(Math.max(1, Number(props.rows ?? 3)), 10);
      const nC = Math.min(Math.max(1, Number(props.columns ?? 3)), 6);
      setProp("cellData", Array.from({ length: nR }, () => Array.from({ length: nC }, () => "—")));
      setProp("headers", Array.from({ length: nC }, (_, i) => `Col ${i + 1}`));
    };
    const handleColWidthsChange = (raw: string) => {
      const nC = Math.min(Math.max(1, Number(props.columns ?? 3)), 6);
      const parts = raw.split(",").map((s) => s.trim());
      const widths: string[] = Array.from({ length: nC }, (_, i) => parts[i] ?? "");
      setProp("colWidths", widths);
    };
    const colWidthsValue = ((props.colWidths as string[] | undefined) ?? []).join(", ");
    return (
      <>
        <PropRow label="Rows"><NumberProp value={props.rows ?? 3} onChange={handleRowsChange} min={1} max={10} /></PropRow>
        <PropRow label="Columns"><NumberProp value={props.columns ?? 3} onChange={handleColsChange} min={1} max={6} /></PropRow>
        <PropRow label="Col widths">
          <TextProp
            value={colWidthsValue}
            onChange={handleColWidthsChange}
            placeholder="e.g. 80px, 200px, 120px"
          />
        </PropRow>
        <PropRow label="Cells">
          <button
            onClick={handleReset}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Reset to "—"
          </button>
        </PropRow>
      </>
    );
  }

  if (displayName === "AstryxTabs") return (
    <>
      <PropRow label="Tabs (comma-sep)"><TextProp value={props.tabs ?? "Tab 1,Tab 2,Tab 3"} onChange={(v) => setProp("tabs", v)} /></PropRow>
      <PropRow label="Active tab"><TextProp value={props.active ?? "Tab 1"} onChange={(v) => setProp("active", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxAccordion") return (
    <>
      <PropRow label="Items (comma-sep)"><TextProp value={props.items ?? "Section A,Section B"} onChange={(v) => setProp("items", v)} /></PropRow>
      <PropRow label="Open item"><TextProp value={props.open ?? "Section A"} onChange={(v) => setProp("open", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxCalendar") return (
    <PropRow label="Month"><TextProp value={props.month ?? "July 2026"} onChange={(v) => setProp("month", v)} /></PropRow>
  );

  if (displayName === "AstryxCommand") return (
    <PropRow label="Placeholder"><TextProp value={props.placeholder ?? "Search…"} onChange={(v) => setProp("placeholder", v)} /></PropRow>
  );

  if (displayName === "AstryxCarousel") return (
    <PropRow label="Slides (comma-sep)"><TextProp value={props.slides ?? "Slide 1,Slide 2,Slide 3"} onChange={(v) => setProp("slides", v)} /></PropRow>
  );

  if (displayName === "AstryxResizable") return (
    <PropRow label="Direction"><SelectProp value={props.direction ?? "horizontal"} options={["horizontal","vertical"]} onChange={(v) => setProp("direction", v)} /></PropRow>
  );

  if (displayName === "AstryxField") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? "Field label"} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Help text"><TextProp value={props.helpText ?? ""} onChange={(v) => setProp("helpText", v)} /></PropRow>
      <PropRow label="Error"><TextProp value={props.error ?? ""} onChange={(v) => setProp("error", v)} placeholder="Shown instead of help text" /></PropRow>
      <PropRow label="Required">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.required} onChange={(v) => setProp("required", v)} />
          <span className="text-xs text-muted-foreground">{props.required ? "Yes" : "No"}</span>
        </div>
      </PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 4} onChange={(v) => setProp("gap", Math.max(0, v))} min={0} /></PropRow>
    </>
  );

  if (displayName === "AstryxFieldStatus") return (
    <PropRow label="Status"><SelectProp value={props.status ?? "error"} options={["error","success","warning","info"]} onChange={(v) => setProp("status", v)} /></PropRow>
  );

  if (displayName === "AstryxFormLayout") return (
    <>
      <PropRow label="Columns"><NumberProp value={props.columns ?? 1} onChange={(v) => setProp("columns", Math.min(4, Math.max(1, v)))} min={1} max={4} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 16} onChange={(v) => setProp("gap", Math.max(0, v))} min={0} /></PropRow>
    </>
  );

  if (displayName === "AstryxInputGroup") return (
    <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 0} onChange={(v) => setProp("gap", Math.max(0, v))} min={0} /></PropRow>
  );

  if (displayName === "AstryxGrid") return (
    <>
      <PropRow label="Columns"><NumberProp value={props.columns ?? 2} onChange={(v) => setProp("columns", Math.min(6, Math.max(1, v)))} min={1} max={6} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 12} onChange={(v) => setProp("gap", Math.max(0, v))} min={0} /></PropRow>
      <PropRow label="Align"><SelectProp value={props.align ?? "stretch"} options={["stretch","start","center","end"]} onChange={(v) => setProp("align", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxTextArea") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? ""} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Placeholder"><TextProp value={props.placeholder ?? "Enter text…"} onChange={(v) => setProp("placeholder", v)} /></PropRow>
      <PropRow label="Rows"><NumberProp value={props.rows ?? 4} onChange={(v) => setProp("rows", Math.min(20, Math.max(1, v)))} min={1} max={20} /></PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxSwitch") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? "Enable option"} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Checked">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.checked} onChange={(v) => setProp("checked", v)} />
          <span className="text-xs text-muted-foreground">{props.checked ? "Yes" : "No"}</span>
        </div>
      </PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxNumberInput") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? ""} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Value"><NumberProp value={props.value ?? 0} onChange={(v) => setProp("value", v)} /></PropRow>
      <PropRow label="Min"><NumberProp value={props.min ?? 0} onChange={(v) => setProp("min", v)} /></PropRow>
      <PropRow label="Max"><NumberProp value={props.max ?? 100} onChange={(v) => setProp("max", v)} /></PropRow>
      <PropRow label="Step"><NumberProp value={props.step ?? 1} onChange={(v) => setProp("step", v)} min={1} /></PropRow>
    </>
  );

  if (displayName === "AstryxToggleButton") return (
    <>
      <PropRow label="Label"><TextProp value={props.children ?? "Toggle"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
      <PropRow label="Pressed">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.pressed} onChange={(v) => setProp("pressed", v)} />
          <span className="text-xs text-muted-foreground">{props.pressed ? "Yes" : "No"}</span>
        </div>
      </PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxSegmentedControl") return (
    <>
      <PropRow label="Options (comma-sep)"><TextProp value={props.options ?? "Option A,Option B,Option C"} onChange={(v) => setProp("options", v)} /></PropRow>
      <PropRow label="Selected"><TextProp value={props.selected ?? "Option A"} onChange={(v) => setProp("selected", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxCheckboxList") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? ""} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Options (comma-sep)"><TextProp value={props.options ?? "Option A,Option B,Option C"} onChange={(v) => setProp("options", v)} /></PropRow>
      <PropRow label="Selected (comma-sep)"><TextProp value={props.selected ?? ""} onChange={(v) => setProp("selected", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxIconButton") return (
    <>
      <PropRow label="Icon">
        <IconPickerProp value={String(props.name ?? "star")} onChange={(v) => setProp("name", v)} />
      </PropRow>
      <PropRow label="Variant"><SelectProp value={props.variant ?? "outline"} options={["primary","secondary","outline","ghost"]} onChange={(v) => setProp("variant", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxArtboard") return (
    <PropRow label="Label"><TextProp value={props.label ?? "Artboard"} onChange={(v) => setProp("label", v)} /></PropRow>
  );

  return <p className="text-xs text-muted-foreground">No editable properties.</p>;
}

// ─── Inspect panel (rendered inside left rail when element is selected) ────────

interface SelectedNode {
  id: string;
  displayName: string;
  props: Record<string, any>;
  isRoot: boolean;
}

const COLOR_SWATCHES_MAP: Record<string, string> = {
  blue: "#3b82f6", green: "#10b981", amber: "#f59e0b",
  red: "#ef4444", purple: "#8b5cf6", gray: "#6b7280",
};

const SPACING_PRESETS = [
  { label: "Compact",     sub: "gap 4 · pad 8",   gap: 4,  padding: 8  },
  { label: "Default",     sub: "gap 8 · pad 12",  gap: 8,  padding: 12 },
  { label: "Comfortable", sub: "gap 12 · pad 16", gap: 12, padding: 16 },
  { label: "Spacious",    sub: "gap 20 · pad 24", gap: 20, padding: 24 },
];

const HAS_COLOR_PROP = new Set(["AstryxBadge","AstryxProgressBar"]);
const HAS_VARIANT_DISPLAY = new Set(["AstryxButton","AstryxBanner"]);
const HAS_SIZE_PROP = new Set(["AstryxButton","AstryxBadge","AstryxAvatar","AstryxText","AstryxHeading","AstryxSpinner","AstryxStatusDot","AstryxIcon","AstryxToken","AstryxSelect"]);
const IS_CONTAINER = new Set(["AstryxSection","AstryxStack","AstryxHStack","AstryxArtboard"]);
// Containers that accept backgroundColor/textColor — and so must trigger the
// auto-contrast pass — but are not flex containers with align/justify controls.
const NON_FLEX_CONTAINERS = new Set([
  "AstryxCard","AstryxField","AstryxFieldStatus","AstryxFormLayout","AstryxInputGroup","AstryxGrid",
]);
const NO_RADIUS = new Set([
  "AstryxBadge","AstryxAvatar","AstryxSkeleton","AstryxSpinner",
  // Fixed-shape or layout-only components that ignore borderRadius entirely.
  "AstryxSwitch","AstryxCheckboxList",
  "AstryxField","AstryxFieldStatus","AstryxFormLayout","AstryxInputGroup","AstryxGrid",
]);
const HAS_TYPOGRAPHY = new Set(["AstryxText","AstryxHeading","AstryxButton"]);

const ALIGN_OPTIONS = {
  horizontal: [
    { value: "start", label: "Align start", icon: <AlignHorizontalJustifyStart className="w-3.5 h-3.5" /> },
    { value: "center", label: "Align center", icon: <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" /> },
    { value: "end", label: "Align end", icon: <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" /> },
    { value: "stretch", label: "Stretch horizontally", icon: <StretchHorizontal className="w-3.5 h-3.5" /> },
  ],
  vertical: [
    { value: "start", label: "Align start", icon: <AlignVerticalJustifyStart className="w-3.5 h-3.5" /> },
    { value: "center", label: "Align center", icon: <AlignVerticalJustifyCenter className="w-3.5 h-3.5" /> },
    { value: "end", label: "Align end", icon: <AlignVerticalJustifyEnd className="w-3.5 h-3.5" /> },
    { value: "stretch", label: "Stretch vertically", icon: <StretchVertical className="w-3.5 h-3.5" /> },
  ],
} satisfies Record<string, LayoutOption[]>;

const JUSTIFY_OPTIONS = {
  horizontal: [
    { value: "start", label: "Justify start", icon: <AlignHorizontalJustifyStart className="w-3.5 h-3.5" /> },
    { value: "center", label: "Justify center", icon: <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" /> },
    { value: "end", label: "Justify end", icon: <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" /> },
    { value: "between", label: "Space between", icon: <AlignHorizontalSpaceBetween className="w-3.5 h-3.5" /> },
    { value: "around", label: "Space around", icon: <AlignHorizontalSpaceAround className="w-3.5 h-3.5" /> },
  ],
  vertical: [
    { value: "start", label: "Justify start", icon: <AlignVerticalJustifyStart className="w-3.5 h-3.5" /> },
    { value: "center", label: "Justify center", icon: <AlignVerticalJustifyCenter className="w-3.5 h-3.5" /> },
    { value: "end", label: "Justify end", icon: <AlignVerticalJustifyEnd className="w-3.5 h-3.5" /> },
    { value: "between", label: "Space between", icon: <AlignVerticalSpaceBetween className="w-3.5 h-3.5" /> },
    { value: "around", label: "Space around", icon: <AlignVerticalSpaceAround className="w-3.5 h-3.5" /> },
  ],
} satisfies Record<string, LayoutOption[]>;

const WRAP_OPTIONS: LayoutOption[] = [
  { value: "nowrap", label: "No wrap", icon: <Minus className="w-3.5 h-3.5" /> },
  { value: "wrap", label: "Wrap", icon: <WrapText className="w-3.5 h-3.5" /> },
  { value: "wrap-reverse", label: "Wrap reverse", icon: <WrapText className="w-3.5 h-3.5 -scale-y-100" /> },
];

function DimensionControl({
  label,
  value,
  autoDefault,
  onChange,
  min,
}: {
  label: string;
  value: number | string | undefined | "mixed";
  autoDefault: number | "auto";
  onChange: (value: number | undefined) => void;
  min?: number;
}) {
  const isMixed = value === "mixed";
  const isAuto = value == null || value === "auto";
  const [draft, setDraft] = useState<string | null>(null);
  const inputValue = draft ?? (isMixed ? "Mixed" : isAuto ? "" : String(value));
  return (
    <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-2 py-1.5">
      <span className="text-[9.5px] text-muted-foreground font-medium w-3">{label}</span>
      <input
        // Always type="text": switching between "number" and "text" mid-edit
        // makes React recreate the DOM node, which resets the caret to
        // position 0 and reverses typed digits (e.g. "400" became "004").
        type="text"
        inputMode="decimal"
        value={inputValue}
        onFocus={() => { if (isMixed) setDraft(""); }}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw !== "") {
            const next = Number(raw);
            if (Number.isFinite(next) && (min == null || next >= min)) onChange(next);
          }
        }}
        onBlur={(e) => {
          if (e.target.value === "") onChange(undefined);
          setDraft(null);
        }}
        placeholder={isMixed ? "Mixed" : "auto"}
        aria-label={`${label} size`}
        className="flex-1 min-w-0 text-[10px] font-mono bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
      />
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-label={`${label} auto`}
        aria-pressed={isAuto}
        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 ${
          isAuto
            ? "border-blue-400 text-blue-500 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
        }`}
      >
        Auto
      </button>
    </div>
  );
}

export function getSharedDimensionValue(
  propsList: Array<Record<string, any>>,
  key: "width" | "height",
): number | string | undefined | "mixed" {
  const values = propsList.map((props) => props[key]);
  if (values.length === 0) return undefined;
  const normalized = values.map((value) => value == null || value === "auto" ? "auto" : value);
  return normalized.every((value) => value === normalized[0]) ? values[0] : "mixed";
}

function InspectPanel({ selected, selectedIds, actions }: { selected: SelectedNode; selectedIds: string[]; actions: any }) {
  const { query, nodes } = useEditor((state) => ({ nodes: state.nodes }));
  const isMultiSelect = selectedIds.length > 1;
  const selectedNodes = selectedIds
    .map((id) => nodes[id])
    .filter(Boolean);
  const sharedValue = useCallback((key: string): any => {
    const propsList = selectedNodes.map((node: any) => node.data.props ?? {});
    if (propsList.length === 0) return selected.props[key];
    return getSharedDimensionValue(propsList, key as "width" | "height");
  }, [selectedNodes, selected.props]);

  const setProp = useCallback(
    (key: string, value: any) => {
      const targetIds = isMultiSelect ? selectedIds : [selected.id];
      actions.history.throttle(0);
      targetIds.forEach((id: string) => actions.setProp(id, (p: any) => {
          p[key] = value;
          // When the user manually sets a text color, mark it as user-owned so
          // auto-contrast won't overwrite it on future background changes.
          if (key === "color") p._autoColor = false;
          // A manual width edit opts the node back out of equal-width flex
          // sizing — the renderer ignores `width` while flexBasis is set.
          if (key === "width") clearFlexSizingProps(p);
        }));

      // Auto-apply contrast whenever backgroundColor changes on a container.
      // Uses history.ignore() so auto-contrast changes don't pollute the undo stack.
      if (key === "backgroundColor" && typeof value === "string" && value !== "transparent") {
        const isContainerNode = IS_CONTAINER.has(selected.displayName) || NON_FLEX_CONTAINERS.has(selected.displayName);
        if (isContainerNode) {
          try {
            // Build a patched snapshot of the canvas with the new backgroundColor applied,
            // then run applyContrastColors on the full subtree so nested containers are
            // respected — each text leaf derives its color from its nearest ancestor's BG.
            const allNodes = JSON.parse(query.serialize()) as Record<string, any>;
            targetIds.forEach((id: string) => {
              allNodes[id] = {
                ...allNodes[id],
                props: { ...(allNodes[id]?.props ?? {}), backgroundColor: value },
              };
            });

            // Collect subtree node IDs (selected + all descendants)
            const subtreeIds = new Set<string>();
            const queue: string[] = [...targetIds];
            while (queue.length > 0) {
              const nId = queue.shift()!;
              subtreeIds.add(nId);
              const n = allNodes[nId];
              if (Array.isArray(n?.nodes)) queue.push(...n.nodes);
            }
            const subtree: Record<string, any> = {};
            for (const id of Array.from(subtreeIds)) subtree[id] = allNodes[id];

            // applyContrastColors correctly walks parent chains, so each leaf text
            // node gets the contrast of its nearest background-owning ancestor.
            const updated = applyContrastColors(subtree);

            // Apply only the changed props via history.ignore()
            for (const [nodeId, updatedNode] of Object.entries(updated)) {
              const origNode = subtree[nodeId];
              const uProps = (updatedNode as any).props ?? {};
              const oProps = origNode?.props ?? {};
              if (uProps.textColor !== oProps.textColor) {
                const tc = uProps.textColor;
                actions.history.ignore().setProp(nodeId, (p: any) => { p.textColor = tc; });
              }
              if (uProps.color !== oProps.color) {
                const c = uProps.color;
                const ac = uProps._autoColor;
                actions.history.ignore().setProp(nodeId, (p: any) => { p.color = c; p._autoColor = ac; });
              }
            }
          } catch { /* ignore — canvas state may not be serializable during initial load */ }
        }
      }
    },
    [selected.id, selected.displayName, selectedIds, isMultiSelect, actions, query],
  );
  const setTextColor = useCallback((value: string | undefined) => {
    const targetIds = isMultiSelect ? selectedIds : [selected.id];
    targetIds.forEach((id: string) => {
      const node = nodes[id];
      const displayName = node?.data?.displayName;
      const key = displayName === "AstryxText" || displayName === "AstryxHeading"
        ? "color"
        : "textColor";
      actions.setProp(id, (props: any) => {
        props[key] = value;
        if (key === "color") props._autoColor = false;
      });
    });
  }, [selected.id, selectedIds, isMultiSelect, nodes, actions]);

  const equalWidthResult = useMemo(
    () => getEqualWidthSelectionResult(nodes as any, selectedIds),
    [nodes, selectedIds],
  );

  const makeEqualWidths = useCallback(() => {
    if (!equalWidthResult.eligible) return;
    actions.history.throttle(0);
    selectedIds.forEach((id) => {
      actions.setProp(id, (props: Record<string, any>) => {
        applyEqualWidthProps(props);
      });
    });
  }, [actions, equalWidthResult, selectedIds]);

  const equalHeightResult = useMemo(
    () => getEqualHeightSelectionResult(nodes as any, selectedIds),
    [nodes, selectedIds],
  );

  const makeEqualHeights = useCallback(() => {
    if (!equalHeightResult.eligible) return;
    actions.history.throttle(0);
    selectedIds.forEach((id) => {
      actions.setProp(id, (props: Record<string, any>) => {
        applyEqualHeightProps(props);
      });
    });
  }, [actions, equalHeightResult, selectedIds]);

  // ── Multi-artboard selection detection & geometry actions ─────────────────
  const artboardSelection = useMemo(() => {
    let artboardCount = 0;
    let componentCount = 0;
    for (const id of selectedIds) {
      const node: any = nodes[id];
      if (!node) continue;
      if (node.data?.displayName === "AstryxArtboard") artboardCount++;
      else if (id !== "ROOT") componentCount++;
    }
    return { artboardCount, componentCount, allArtboards: artboardCount >= 2 && componentCount === 0 };
  }, [nodes, selectedIds]);

  const applyArtboardAlign = useCallback((edge: AlignEdge) => {
    try {
      const s = JSON.parse(query.serialize()) as Record<string, any>;
      const next = alignArtboardsInState(s, selectedIds, edge);
      if (next !== s) {
        actions.deserialize(JSON.stringify(next));
        // deserialize clears craft's selection — restore it so the user can
        // keep acting on the same group (drag, further aligns, delete).
        actions.selectNode(selectedIds);
      }
    } catch (err) { console.error("[artboard-align]", err); }
  }, [actions, query, selectedIds]);

  const applyArtboardDistribute = useCallback((axis: DistributeAxis) => {
    try {
      const s = JSON.parse(query.serialize()) as Record<string, any>;
      const next = distributeArtboardsInState(s, selectedIds, axis);
      if (next !== s) {
        actions.deserialize(JSON.stringify(next));
        actions.selectNode(selectedIds);
      }
    } catch (err) { console.error("[artboard-distribute]", err); }
  }, [actions, query, selectedIds]);

  const dn = selected.displayName;
  const shortName = dn.replace("Astryx", "");
  const isFlexContainer = IS_CONTAINER.has(dn);
  const isArtboard = dn === "AstryxArtboard";
  const supportsDirection = dn === "AstryxSection" || isArtboard;
  const supportsPadding = supportsDirection;
  const hasSizeProp = HAS_SIZE_PROP.has(dn);
  const hasTypography = HAS_TYPOGRAPHY.has(dn);
  const isRoot = selected.isRoot;
  const direction = dn === "AstryxHStack" ? "row" : selected.props.direction ?? "column";
  const alignOptions = direction === "row" ? ALIGN_OPTIONS.vertical : ALIGN_OPTIONS.horizontal;
  const justifyOptions = direction === "row" ? JUSTIFY_OPTIONS.horizontal : JUSTIFY_OPTIONS.vertical;
  const widthDefault = isArtboard ? 390 : dn === "AstryxSkeleton" ? 120 : 320;
  const heightDefault = isArtboard ? 480 : dn === "AstryxSkeleton" ? 16 : 120;

  // Determine active spacing preset for containers
  const activeSpacing = SPACING_PRESETS.find(
    (p) => p.gap === (selected.props.gap ?? 8) && p.padding === (selected.props.padding ?? 12),
  );

  return (
    <div className="flex flex-col overflow-y-auto h-full">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-background z-10 flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          <span className="text-[11.5px] font-semibold text-foreground truncate">{isMultiSelect ? `${selectedIds.length} selected` : shortName}</span>
          <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">
            {selected.isRoot ? "root" : "element"}
          </span>
        </div>
        <button
          title="Close inspect panel"
          onClick={() => actions.selectNode(undefined as any)}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-1 text-base leading-none"
        >
          ×
        </button>
      </div>

      {/* ── Color ────────────────────────────────────────────────── */}
       {(isMultiSelect || dn !== "AstryxArtboard") && <section className="px-3 py-3 border-b border-border">
        <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Color</div>

        {/* Background swatches — universal */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 font-medium">BG</span>
          <div className="flex gap-1.5 flex-wrap">
            {/* Transparent tile */}
            <button
              key="transparent"
              onClick={() => setProp("backgroundColor", "transparent")}
              title="Transparent"
              style={{
                backgroundImage: "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
                backgroundSize: "6px 6px",
                backgroundPosition: "0 0,0 3px,3px -3px,-3px 0px",
                backgroundColor: "#fff",
                boxShadow: (sharedValue("backgroundColor") == null || sharedValue("backgroundColor") === "transparent" || sharedValue("backgroundColor") === "mixed")
                  ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px #3b82f6`
                  : undefined,
              }}
              className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
            />
            {["#ffffff","#f8fafc","#1e293b","#000000","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"].map((hex) => (
              <button
                key={hex}
                onClick={() => setProp("backgroundColor", hex)}
                title={hex}
                style={{
                  background: hex,
                   boxShadow: sharedValue("backgroundColor") === hex
                    ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                    : undefined,
                }}
                className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
              />
            ))}
          </div>
        </div>

        {/* Text swatches — universal */}
        {(() => {
          const isTextNode = dn === "AstryxText" || dn === "AstryxHeading";
          const activeTextColor = isMultiSelect
            ? "mixed"
            : isTextNode
            ? (selected.props.color ?? selected.props.textColor)
            : selected.props.textColor;
          const clearTextColor = () => {
            setTextColor(undefined);
          };
          return (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 font-medium">Text</span>
              <div className="flex gap-1.5 flex-wrap">
                {/* Clear/reset tile */}
                <button
                  key="clear"
                  onClick={clearTextColor}
                  title="Default (clear)"
                  style={{
                    backgroundImage: "linear-gradient(to top right, transparent calc(50% - 0.5px), #ef4444 calc(50% - 0.5px), #ef4444 calc(50% + 0.5px), transparent calc(50% + 0.5px))",
                    backgroundColor: "#fff",
                    boxShadow: !activeTextColor || activeTextColor === "mixed"
                      ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px #3b82f6`
                      : undefined,
                  }}
                  className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
                />
                {["#000000","#1e293b","#64748b","#ffffff","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"].map((hex) => (
                  <button
                    key={hex}
                    onClick={() => setTextColor(hex)}
                    title={hex}
                    style={{
                      background: hex,
                      boxShadow: activeTextColor === hex
                        ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                        : undefined,
                    }}
                    className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Component-specific: `color` token (Badge, ProgressBar) */}
        {!isMultiSelect && HAS_COLOR_PROP.has(dn) && (
          <div className="flex gap-1.5 flex-wrap mt-2.5 pt-2.5 border-t border-border">
            {Object.entries(COLOR_SWATCHES_MAP).map(([name, hex]) => (
              <button
                key={name}
                onClick={() => setProp("color", name)}
                title={name}
                style={{
                  background: hex,
                  boxShadow: selected.props.color === name
                    ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                    : undefined,
                }}
                className="w-6 h-6 rounded-lg border border-black/10 transition-all hover:scale-110"
              />
            ))}
          </div>
        )}

        {/* Component-specific: `variant` color (Button, Banner) */}
        {!isMultiSelect && HAS_VARIANT_DISPLAY.has(dn) && dn === "AstryxButton" && (
          <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2.5 border-t border-border">
            {["primary","secondary","outline","ghost"].map((v) => (
              <button
                key={v}
                onClick={() => setProp("variant", v)}
                className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium text-left capitalize transition-all ${
                  selected.props.variant === v
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground bg-background"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {!isMultiSelect && HAS_VARIANT_DISPLAY.has(dn) && dn === "AstryxBanner" && (
          <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2.5 border-t border-border">
            {["info","success","warning","error"].map((v) => (
              <button
                key={v}
                onClick={() => setProp("variant", v)}
                className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium text-left capitalize transition-all ${
                  selected.props.variant === v
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground bg-background"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </section>}

      {/* ── Background (artboard only) ───────────────────────────── */}
      {!isMultiSelect && dn === "AstryxArtboard" && (
        <section className="px-3 py-3 border-b border-border">
          <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Background</div>
          <ArtboardBackgroundPicker props={selected.props} setProp={setProp} />
        </section>
      )}

      {/* ── Size & Shape ─────────────────────────────────────────── */}
      <section className="px-3 py-3 border-b border-border">
        <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Size & Shape</div>

        {/* Size token row — for components that have a `size` prop */}
        {hasSizeProp && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">Size</span>
            <div className="flex gap-1 flex-wrap">
              {(dn === "AstryxText" ? ["xs","sm","md","lg"] :
                dn === "AstryxHeading" ? ["sm","md","lg","xl","2xl"] :
                ["xs","sm","md","lg","xl"]
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => setProp("size", s)}
                  className={`min-w-[28px] h-6 px-1.5 text-[9.5px] rounded-md border font-medium transition-all ${
                    selected.props.size === s
                      ? "bg-foreground border-foreground text-background shadow-sm"
                      : "border-border text-muted-foreground hover:border-muted-foreground bg-background"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Border radius token row — hidden for fixed-shape components */}
        {!isMultiSelect && !NO_RADIUS.has(dn) && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">Radius</span>
          <div className="flex gap-1 flex-wrap">
            {(["None","S","M","L","Full"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setProp("borderRadius", r)}
                className={`min-w-[28px] h-6 px-1.5 text-[9.5px] rounded-md border font-medium transition-all ${
                  (selected.props.borderRadius ?? "M") === r
                    ? "bg-foreground border-foreground text-background shadow-sm"
                    : "border-border text-muted-foreground hover:border-muted-foreground bg-background"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        )}
      </section>

      {/* ── Typography ───────────────────────────────────────────── */}
      {!isMultiSelect && hasTypography && (
        <section className="px-3 py-3 border-b border-border">
          <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Typography</div>

          {/* Content editable */}
          {(dn === "AstryxText" || dn === "AstryxHeading" || dn === "AstryxButton") && (
            <div className="mb-2.5">
              <PropRow label="Content">
                <TextProp value={selected.props.children ?? ""} onChange={(v) => setProp("children", v)} />
              </PropRow>
            </div>
          )}

          {/* Size token row for text/heading */}
          {(dn === "AstryxText" || dn === "AstryxHeading") && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">Size</span>
              <div className="flex gap-1">
                {(dn === "AstryxText" ? ["xs","sm","md","lg"] : ["sm","md","lg","xl","2xl"]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setProp("size", s)}
                    className={`min-w-[28px] h-6 px-1.5 text-[9.5px] rounded-md border font-medium transition-all ${
                      selected.props.size === s
                        ? "bg-foreground border-foreground text-background shadow-sm"
                        : "border-border text-muted-foreground hover:border-muted-foreground bg-background"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Font + B/I/U */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-2 py-1.5">
              <span className="text-[10px] text-muted-foreground">Inter</span>
              <span className="text-muted-foreground/40 text-[10px]">▾</span>
            </div>
            <div className="flex gap-0.5">
              {[["B","font-bold"],["I","italic"],["U","underline"]].map(([l, c]) => (
                <button
                  key={l}
                  className={`w-6 h-7 text-[10px] ${c} border border-border rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Properties (component-specific catch-all) ─────────────── */}
      <section className="px-3 py-3">
        <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Properties</div>
        <div className="flex flex-col gap-3">
          {/* Shared sizing and positioning controls live here for every node. */}
          <div className="grid grid-cols-2 gap-1.5">
            <DimensionControl
              label="W"
              value={sharedValue("width")}
              autoDefault={widthDefault}
              onChange={(v) => setProp("width", v)}
              min={isArtboard ? 100 : dn === "AstryxSkeleton" ? 8 : 1}
            />
            <DimensionControl
              label="H"
              value={sharedValue("height")}
              autoDefault={heightDefault}
              onChange={(v) => setProp("height", v)}
              min={isArtboard ? 100 : dn === "AstryxSkeleton" ? 4 : 1}
            />
          </div>

          {isMultiSelect && artboardSelection.allArtboards && (
            <div className="rounded-lg border border-border bg-muted/30 p-2.5" data-testid="artboard-align-panel">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-foreground">Align artboards</span>
                <span className="text-[9px] text-muted-foreground">{artboardSelection.artboardCount} screens</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  ["left",     "Align left edges",   <AlignHorizontalJustifyStart className="w-3.5 h-3.5" key="l" />],
                  ["center-h", "Align horizontal centers", <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" key="ch" />],
                  ["right",    "Align right edges",  <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" key="r" />],
                  ["top",      "Align top edges",    <AlignVerticalJustifyStart className="w-3.5 h-3.5" key="t" />],
                  ["center-v", "Align vertical centers", <AlignVerticalJustifyCenter className="w-3.5 h-3.5" key="cv" />],
                  ["bottom",   "Align bottom edges", <AlignVerticalJustifyEnd className="w-3.5 h-3.5" key="b" />],
                ] as [AlignEdge, string, ReactNode][]).map(([edge, label, icon]) => (
                  <button
                    key={edge}
                    type="button"
                    onClick={() => applyArtboardAlign(edge)}
                    title={label}
                    aria-label={label}
                    data-testid={`artboard-align-${edge}`}
                    className="flex items-center justify-center rounded-md border border-border bg-background py-1.5 text-foreground transition-colors hover:border-foreground hover:bg-accent"
                  >
                    {icon}
                  </button>
                ))}
              </div>
              {artboardSelection.artboardCount >= 3 && (
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => applyArtboardDistribute("horizontal")}
                    title="Equal horizontal gaps"
                    aria-label="Distribute artboards with equal horizontal gaps"
                    data-testid="artboard-distribute-horizontal"
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:border-foreground hover:bg-accent"
                  >
                    <AlignHorizontalSpaceBetween className="w-3.5 h-3.5" />
                    Equal H gaps
                  </button>
                  <button
                    type="button"
                    onClick={() => applyArtboardDistribute("vertical")}
                    title="Equal vertical gaps"
                    aria-label="Distribute artboards with equal vertical gaps"
                    data-testid="artboard-distribute-vertical"
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:border-foreground hover:bg-accent"
                  >
                    <AlignVerticalSpaceBetween className="w-3.5 h-3.5" />
                    Equal V gaps
                  </button>
                </div>
              )}
            </div>
          )}

          {isMultiSelect && !artboardSelection.allArtboards && artboardSelection.artboardCount > 0 && artboardSelection.componentCount > 0 && (
            <p className="text-[9px] leading-snug text-muted-foreground rounded-lg border border-border bg-muted/30 p-2.5">
              Selection mixes screens and elements. Select only screens to align them, or only elements for layout actions.
            </p>
          )}

          {isMultiSelect && !artboardSelection.allArtboards && artboardSelection.artboardCount === 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-foreground">Layout</span>
                <span className="text-[9px] text-muted-foreground">Selected elements</span>
              </div>
              <button
                type="button"
                onClick={makeEqualWidths}
                disabled={!equalWidthResult.eligible}
                title={equalWidthResult.eligible ? "Make selected elements equal widths" : equalWidthResult.reason}
                aria-label="Make selected elements equal widths"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:border-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <StretchHorizontal className="w-3.5 h-3.5" />
                  Equal widths
                </span>
              </button>
              {!equalWidthResult.eligible && (
                <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">{equalWidthResult.reason}</p>
              )}
              <button
                type="button"
                onClick={makeEqualHeights}
                disabled={!equalHeightResult.eligible}
                title={equalHeightResult.eligible ? "Make selected elements equal heights" : equalHeightResult.reason}
                aria-label="Make selected elements equal heights"
                className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium text-foreground transition-colors hover:border-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <StretchVertical className="w-3.5 h-3.5" />
                  Equal heights
                </span>
              </button>
              {!equalHeightResult.eligible && (
                <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">{equalHeightResult.reason}</p>
              )}
            </div>
          )}

          {!isMultiSelect && !isRoot && !isArtboard && (
            <>
              <PropRow label="Position">
                <SelectProp
                  value={selected.props.position ?? "flow"}
                  options={["flow", "absolute"]}
                  onChange={(v) => setProp("position", v)}
                />
              </PropRow>
              <div className="grid grid-cols-2 gap-1.5">
                {([["X", "x"], ["Y", "y"]] as const).map(([label, key]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 bg-muted/50 border rounded-lg px-2 py-1.5 transition-opacity ${
                      selected.props.position !== "absolute" ? "opacity-40 border-border" : "border-border"
                    }`}
                  >
                    <span className="text-[9.5px] text-muted-foreground font-medium w-3">{label}</span>
                    <input
                      type="number"
                      value={selected.props[key] ?? 0}
                      onChange={(e) => setProp(key, Number(e.target.value))}
                      disabled={selected.props.position !== "absolute"}
                      aria-label={`${label} position`}
                      className="flex-1 min-w-0 text-[10px] font-mono bg-transparent border-none outline-none text-foreground disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {!isMultiSelect && isArtboard && (
            <div className="grid grid-cols-2 gap-1.5">
              {([["X", "x", 64], ["Y", "y", 64]] as const).map(([label, key, fallback]) => (
                <div key={key} className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-2 py-1.5">
                  <span className="text-[9.5px] text-muted-foreground font-medium w-3">{label}</span>
                  <input
                    type="number"
                    value={selected.props[key] ?? fallback}
                    onChange={(e) => setProp(key, Number(e.target.value))}
                    aria-label={`${label} position`}
                    className="flex-1 min-w-0 text-[10px] font-mono bg-transparent border-none outline-none text-foreground"
                  />
                </div>
              ))}
            </div>
          )}

          {!isMultiSelect && isFlexContainer && (
            <>
              {supportsDirection && (
                <PropRow label="Direction">
                  <SelectProp value={direction} options={["column", "row"]} onChange={(v) => setProp("direction", v)} />
                </PropRow>
              )}
              <div className="grid grid-cols-2 gap-2">
                <PropRow label="Gap (px)">
                  <NumberProp value={selected.props.gap ?? (isArtboard ? 16 : 8)} onChange={(v) => setProp("gap", v)} min={0} />
                </PropRow>
                {supportsPadding && (
                  <PropRow label="Padding (px)">
                    <NumberProp value={selected.props.padding ?? (isArtboard ? 24 : 16)} onChange={(v) => setProp("padding", v)} min={0} />
                  </PropRow>
                )}
              </div>
              <PropRow label="Align items">
                <LayoutIconGroup
                  value={selected.props.align ?? (dn === "AstryxHStack" ? "center" : "stretch")}
                  options={alignOptions}
                  onChange={(v) => setProp("align", v)}
                />
              </PropRow>
              <PropRow label="Justify">
                <LayoutIconGroup
                  value={selected.props.justify ?? "start"}
                  options={justifyOptions}
                  onChange={(v) => setProp("justify", v)}
                />
              </PropRow>
              {!isRoot && (
                <PropRow label="Wrap">
                  <LayoutIconGroup
                    value={selected.props.wrap ?? "nowrap"}
                    options={WRAP_OPTIONS}
                    onChange={(v) => setProp("wrap", v)}
                  />
                </PropRow>
              )}
              {supportsPadding && <div className="grid grid-cols-2 gap-1.5">
                {SPACING_PRESETS.map((p) => {
                  const isActive = activeSpacing?.label === p.label;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      title={`${p.label}: ${p.sub}`}
                      onClick={() => { setProp("gap", p.gap); setProp("padding", p.padding); }}
                      className={`py-1.5 px-2 rounded-lg border text-left transition-all ${
                        isActive ? "bg-foreground border-foreground shadow-sm" : "border-border hover:border-muted-foreground hover:bg-accent bg-background"
                      }`}
                    >
                      <div className={`text-[10px] font-semibold ${isActive ? "text-background" : "text-foreground"}`}>{p.label}</div>
                      <div className={`text-[9px] ${isActive ? "text-background/60" : "text-muted-foreground"}`}>{p.sub}</div>
                    </button>
                  );
                })}
              </div>}
            </>
          )}

          {!isMultiSelect && <ComponentProps displayName={dn} props={selected.props} setProp={setProp} />}
        </div>
      </section>
    </div>
  );
}

// ─── Node type → display icon mapping ────────────────────────────────────────

function layerIcon(displayName: string) {
  if (displayName === "AstryxArtboard") return <LayoutTemplate className="w-3 h-3 text-blue-500 shrink-0" />;
  if (displayName === "AstryxSection")  return <Square className="w-3 h-3 text-purple-400 shrink-0" />;
  if (displayName === "AstryxStack")    return <AlignLeft className="w-3 h-3 text-purple-400 shrink-0" />;
  if (displayName === "AstryxHStack")   return <AlignLeft className="w-3 h-3 text-purple-400 shrink-0" style={{ transform: "rotate(90deg)" }} />;
  if (displayName === "AstryxCard")     return <Square className="w-3 h-3 text-amber-400 shrink-0" />;
  if (displayName === "AstryxText" || displayName === "AstryxHeading") return <Type className="w-3 h-3 text-green-500 shrink-0" />;
  if (displayName === "AstryxButton")   return <ToggleLeft className="w-3 h-3 text-orange-400 shrink-0" />;
  if (displayName === "AstryxDivider")  return <Minus className="w-3 h-3 text-gray-400 shrink-0" />;
  return <Square className="w-3 h-3 text-muted-foreground shrink-0" />;
}

function layerLabel(displayName: string, props: Record<string, any>): string {
  if (props?.label) return props.label as string;
  if (props?.text) return String(props.text).slice(0, 24);
  if (props?.content) return String(props.content).slice(0, 24);
  return displayName.replace(/^Astryx/, "");
}

// ─── Layers tree view ─────────────────────────────────────────────────────────

function LayersView() {
  const { nodes, selectedIds, actions, query } = useEditor((state) => ({
    nodes: state.nodes,
    selectedIds: state.events.selected,
  }));
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["ROOT"]));
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; nodeId: string; isArtboard: boolean;
    siblingIndex: number; siblingCount: number;
  } | null>(null);
  const [editingArtboardId, setEditingArtboardId] = useState<string | null>(null);
  const [artboardDraft, setArtboardDraft] = useState("");
  const artboardInputRef = useRef<HTMLInputElement | null>(null);

  // ── Drag-and-drop state ───────────────────────────────────────────────────
  // `dropTarget` tracks where the ghost line should appear within the node tree.
  // pos: 'before' = line above the row, 'after' = line below the row.
  // `rootDropPos` tracks the top/bottom ROOT-level drop zones that let users
  // detach a node from its artboard and make it a top-level layer.
  const [dragId,     setDragId]     = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ nodeId: string; pos: "before" | "after" } | null>(null);
  const [rootDropPos, setRootDropPos] = useState<"top" | "bottom" | null>(null);

  // Close layers context menu on any click elsewhere.
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [ctxMenu]);

  useEffect(() => {
    if (editingArtboardId) {
      artboardInputRef.current?.focus();
      artboardInputRef.current?.select();
    }
  }, [editingArtboardId]);

  const beginArtboardRename = (id: string, label: string) => {
    setEditingArtboardId(id);
    setArtboardDraft(label);
  };
  const finishArtboardRename = (save: boolean) => {
    if (save && editingArtboardId) {
      const label = artboardDraft.trim();
      if (label) actions.setProp(editingArtboardId, (props: Record<string, unknown>) => { props.label = label; });
    }
    setEditingArtboardId(null);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectNode = (id: string) => { actions.selectNode(id); };

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    // Chrome needs a tiny delay before we can update state or the ghost image breaks.
    setTimeout(() => setDragId(id), 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragId || dragId === id) { setDropTarget(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos: "before" | "after" = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropTarget((prev) =>
      prev?.nodeId === id && prev.pos === pos ? prev : { nodeId: id, pos }
    );
  };

  const handleDragLeave = () => setDropTarget(null);

  const handleDragEnd = () => { setDragId(null); setDropTarget(null); setRootDropPos(null); };

  /** Drop directly onto a ROOT-level zone (top or bottom of the layers list). */
  const handleRootZoneDrop = (e: React.DragEvent, insertAtEnd: boolean) => {
    e.preventDefault(); e.stopPropagation();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (sourceId) {
      try {
        const s = JSON.parse(query.serialize()) as Record<string, any>;
        const rootNodes: string[] = s["ROOT"]?.nodes ?? [];
        const targetIdx = insertAtEnd ? rootNodes.length : 0;
        const next = reorderNodeInParent(s, sourceId, "ROOT", targetIdx);
        if (next) actions.deserialize(JSON.stringify(next));
      } catch (err) { console.error("[layers] root-zone drop:", err); }
    }
    setDragId(null); setDropTarget(null); setRootDropPos(null);
  };

  const handleDrop = (e: React.DragEvent, overNodeId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === overNodeId || !dropTarget) {
      setDragId(null); setDropTarget(null); return;
    }
    try {
      const s = JSON.parse(query.serialize()) as Record<string, any>;
      const overNode = s[overNodeId];
      if (!overNode) return;
      // Determine insertion parent + index.
      const targetParentId: string = overNode.parent ?? "ROOT";
      const siblings: string[] = s[targetParentId]?.nodes ?? [];
      let targetIdx = siblings.indexOf(overNodeId);
      if (targetIdx === -1) targetIdx = siblings.length;
      if (dropTarget.pos === "after") targetIdx++;
      const next = reorderNodeInParent(s, sourceId, targetParentId, targetIdx);
      if (next) actions.deserialize(JSON.stringify(next));
    } catch (err) { console.error("[layers] drag-drop:", err); }
    setDragId(null); setDropTarget(null);
  };

  function renderNode(id: string, depth: number): ReactNode {
    const node = nodes[id];
    if (!node) return null;
    const dn = node.data.displayName as string;
    const props = (node.data.props ?? {}) as Record<string, any>;
    const childIds: string[] = (node.data.nodes as string[]) ?? [];
    const isSelected = selectedIds?.has(id) ?? false;
    const hasChildren = childIds.length > 0;
    const isExpanded = expanded.has(id);
    const isArtboard = dn === "AstryxArtboard";
    const parentId = node.data.parent as string | undefined;
    const siblings: string[] = parentId ? ((nodes[parentId]?.data?.nodes as string[]) ?? []) : [];

    const isDragging    = dragId === id;
    const isDropBefore  = dropTarget?.nodeId === id && dropTarget.pos === "before";
    const isDropAfter   = dropTarget?.nodeId === id && dropTarget.pos === "after";

    return (
      <div key={id} className="relative">
        {/* Drop indicator line — above */}
        {isDropBefore && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-full z-10 pointer-events-none" />
        )}
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(e) => handleDragStart(e, id)}
          onDragOver={(e) => handleDragOver(e, id)}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          onDrop={(e) => handleDrop(e, id)}
          onClick={() => { if (editingArtboardId !== id) selectNode(id); }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            selectNode(id);
            setCtxMenu({
              x: e.clientX, y: e.clientY, nodeId: id, isArtboard,
              siblingIndex: siblings.indexOf(id),
              siblingCount:  siblings.length,
            });
          }}
          className={`w-full flex items-center gap-1 text-left rounded-md px-1 py-[3px] transition-colors group cursor-grab active:cursor-grabbing
            ${isSelected ? "bg-primary/15 text-primary" : "hover:bg-accent text-foreground"}
            ${isDragging ? "opacity-40" : ""}`}
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <span
            className="w-4 h-4 flex items-center justify-center shrink-0"
            onClick={hasChildren ? (e) => toggleExpand(id, e) : undefined}
          >
            {hasChildren
              ? (isExpanded
                  ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
                  : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />)
              : null}
          </span>
          {layerIcon(dn)}
          {isArtboard && editingArtboardId === id ? (
            <input
              ref={artboardInputRef}
              value={artboardDraft}
              aria-label="Artboard name"
              className="text-[10.5px] leading-none ml-0.5 flex-1 min-w-0 h-5 px-1 rounded border border-primary bg-background outline-none"
              onChange={(e) => setArtboardDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={() => finishArtboardRename(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); finishArtboardRename(true); }
                if (e.key === "Escape") { e.preventDefault(); finishArtboardRename(false); }
              }}
            />
          ) : (
            <span
              className="text-[10.5px] truncate leading-none ml-0.5 flex-1 min-w-0"
              onDoubleClick={(e) => {
                if (!isArtboard) return;
                e.preventDefault();
                e.stopPropagation();
                beginArtboardRename(id, layerLabel(dn, props));
              }}
            >
              {layerLabel(dn, props)}
            </span>
          )}
        </div>
        {/* Drop indicator line — below */}
        {isDropAfter && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full z-10 pointer-events-none" />
        )}
        {hasChildren && isExpanded && childIds.map((cid) => renderNode(cid, depth + 1))}
      </div>
    );
  }

  const rootNode = nodes["ROOT"];
  if (!rootNode) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground text-center px-4">No elements yet. Add an artboard to get started.</p>
      </div>
    );
  }

  const topLevel: string[] = (rootNode.data.nodes as string[]) ?? [];

  if (topLevel.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground text-center px-4">Canvas is empty</p>
      </div>
    );
  }

  // Layers context-menu operations — same set as the canvas right-click menu.
  const layersRunOp = (op: () => void) => { setCtxMenu(null); op(); };
  const layersGetState = () => JSON.parse(query.serialize()) as Record<string, any>;

  /** Shared renderer for the two ROOT-level drop-zone strips. */
  const RootDropZone = ({ pos }: { pos: "top" | "bottom" }) => {
    const active = rootDropPos === pos;
    return (
      <div
        className={`relative mx-1 transition-all duration-100 ${dragId ? "h-3" : "h-0 overflow-hidden"}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setRootDropPos(pos); setDropTarget(null); }}
        onDragLeave={(e) => {
          // Only clear if the pointer truly left this zone (not entered a child).
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRootDropPos(null);
        }}
        onDrop={(e) => handleRootZoneDrop(e, pos === "bottom")}
      >
        {active && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary rounded-full" />
        )}
        {active && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <span className="text-[8px] text-primary font-medium bg-background px-1 rounded">
              {pos === "top" ? "↑ detach to top" : "↓ detach to bottom"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 flex flex-col justify-start">
        <RootDropZone pos="top" />
        {topLevel.map((id) => renderNode(id, 0))}
        <RootDropZone pos="bottom" />
      </div>
      {ctxMenu && (() => {
        const { nodeId: id, isArtboard, siblingIndex, siblingCount } = ctxMenu;
        const canDelete   = !isArtboard;
        const canMoveUp   = !isArtboard && siblingIndex > 0;
        const canMoveDown = !isArtboard && siblingIndex < siblingCount - 1;
        return (
          <div
            className="fixed z-[9999] min-w-[196px] rounded-md border border-border bg-popover shadow-lg py-1"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <CtxItem label="Duplicate" shortcut="⌘D" onClick={() => layersRunOp(() => {
              try {
                const s = layersGetState();
                const next = isArtboard ? cloneSubtreeInState(s, id)?.newState : duplicateNodeInState(s, id);
                if (next) actions.deserialize(JSON.stringify(next));
              } catch (err) { console.error("[layers] duplicate:", err); }
            })} />

            <div className="my-1 border-t border-border" />

            <CtxItem label="Copy" shortcut="⌘C" onClick={() => layersRunOp(() => {
              try { copyNodeToClipboard(layersGetState(), id); } catch (err) { console.error("[layers] copy:", err); }
            })} />
            {canDelete && <CtxItem label="Cut" shortcut="⌘X" onClick={() => layersRunOp(() => {
              try { const s = layersGetState(); if (copyNodeToClipboard(s, id)) actions.delete(id); }
              catch (err) { console.error("[layers] cut:", err); }
            })} />}
            <CtxItem label="Paste" shortcut="⌘V" disabled={!_craftClipboard} onClick={_craftClipboard ? () => layersRunOp(() => {
              try {
                const s = layersGetState();
                const next = pasteFromClipboard(s, id);
                if (next) actions.deserialize(JSON.stringify(next));
              } catch (err) { console.error("[layers] paste:", err); }
            }) : undefined} />

            {(canMoveUp || canMoveDown) && (
              <>
                <div className="my-1 border-t border-border" />
                <CtxItem label="Move layer up"   disabled={!canMoveUp}   onClick={canMoveUp ? () => layersRunOp(() => {
                  try { const s = layersGetState(); const next = moveNodeInParent(s, id, "up");   if (next) actions.deserialize(JSON.stringify(next)); }
                  catch (err) { console.error("[layers] move up:", err); }
                }) : undefined} />
                <CtxItem label="Move layer down" disabled={!canMoveDown} onClick={canMoveDown ? () => layersRunOp(() => {
                  try { const s = layersGetState(); const next = moveNodeInParent(s, id, "down"); if (next) actions.deserialize(JSON.stringify(next)); }
                  catch (err) { console.error("[layers] move down:", err); }
                }) : undefined} />
              </>
            )}

            {canDelete ? (
              <>
                <div className="my-1 border-t border-border" />
                <CtxItem label="Delete" danger onClick={() => layersRunOp(() => {
                  try { actions.delete(id); } catch (err) { console.error("[layers] delete:", err); }
                })} />
              </>
            ) : (
              <>
                <div className="my-1 border-t border-border" />
                <CtxItem label="Delete artboard" danger onClick={() => layersRunOp(() => {
                  deleteArtboardFromEditor(actions, query, id);
                })} />
              </>
            )}
          </div>
        );
      })()}
    </>
  );
}

// ─── Left rail: Components + Inspect swap ─────────────────────────────────────

function LeftRail() {
  const multiSelectionIds = useMultiSelectionIds();
  const { connectors, actions, selected, craftSelectedIds, nodes } = useEditor((state) => {
    const selectedIds = state.events.selected;
    if (!selectedIds || selectedIds.size === 0) return { selected: null, craftSelectedIds: [], nodes: state.nodes };
    const [nodeId] = Array.from(selectedIds);
    const node = state.nodes[nodeId];
    if (!node) return { selected: null, craftSelectedIds: [], nodes: state.nodes };
    return {
      selected: {
        id: nodeId,
        displayName: node.data.displayName as string,
        props: { ...node.data.props } as Record<string, any>,
        isRoot: nodeId === "ROOT",
      } as SelectedNode,
      craftSelectedIds: Array.from(selectedIds),
      nodes: state.nodes,
    };
  });
  const selectedIds = multiSelectionIds.length > 1
    ? multiSelectionIds.filter((id) => !!nodes[id])
    : craftSelectedIds;

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // When user explicitly hits "← Back", force components view even if selection is active
  const [forceComponents, setForceComponents] = useState(false);

  // Auto-show inspect panel whenever a new element is selected
  useEffect(() => {
    if (selected) setForceComponents(false);
  }, [selected?.id]);

  const showInspect = !!selected && !forceComponents;

  const toggleCategory = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const trimmed = query.trim().toLowerCase();
  const searchResults = trimmed
    ? TOOLBOX_CATEGORIES.flatMap((cat) =>
        cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(trimmed) ||
            item.description.toLowerCase().includes(trimmed),
        ),
      )
    : [];

  const panelTitle = showInspect ? "Inspect" : "Components";

  return (
    <div
      className="w-[296px] shrink-0 flex flex-col border-r border-border bg-background overflow-hidden"
      style={{ boxShadow: "1px 0 0 hsl(var(--border))" }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-foreground">{panelTitle}</span>
          {showInspect ? (
            <button
              onClick={() => setForceComponents(true)}
              className="flex items-center gap-1 text-[9.5px] text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 rounded-lg px-2 py-1 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={() => setViewMode((v) => v === "grid" ? "list" : "grid")}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors"
              title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            >
              {viewMode === "grid"
                ? <LayoutList className="w-3.5 h-3.5" />
                : <LayoutGrid className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {!showInspect && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full pl-7 pr-6 py-1.5 text-[10px] rounded-xl border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {showInspect ? (
          <InspectPanel selected={selected!} selectedIds={selectedIds} actions={actions} />
        ) : trimmed ? (
          // Search results — grid or list
          searchResults.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-8">No matches</p>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-1.5 p-2.5 pt-2">
              {searchResults.map((item) => (
                <DraggableItem key={item.name} item={item} connectors={connectors} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-2">
              {searchResults.map((item) => (
                <DraggableListItem key={item.name} item={item} connectors={connectors} />
              ))}
            </div>
          )
        ) : viewMode === "grid" ? (
          // Grid view — 2-col tiles grouped by category
          <div className="p-2.5 space-y-3.5">
            {TOOLBOX_CATEGORIES.map((cat) => {
              const isOpen = !collapsed.has(cat.name);
              return (
                <div key={cat.name}>
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex items-center gap-2 mb-1.5 px-0.5 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{cat.name}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[8px] text-muted-foreground/50">{isOpen ? "▴" : "▾"}</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {cat.items.map((item) => (
                        <DraggableItem key={item.name} item={item} connectors={connectors} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // List view — accordions by category, each item as a compact draggable row
          <div className="p-2 space-y-1">
            {TOOLBOX_CATEGORIES.map((cat) => {
              const isOpen = !collapsed.has(cat.name);
              return (
                <div key={cat.name} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <span className="text-[10px] font-semibold text-foreground flex-1 text-left">{cat.name}</span>
                    <span className="text-[9px] text-muted-foreground/50">{cat.items.length}</span>
                    {isOpen
                      ? <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-0 divide-y divide-border/40">
                      {cat.items.map((item) => (
                        <DraggableListItem key={item.name} item={item} connectors={connectors} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notes context ────────────────────────────────────────────────────────────

interface NotesContextValue {
  notesOpen: boolean;
  setNotesOpen: (open: boolean) => void;
}
const NotesContext = createContext<NotesContextValue>({ notesOpen: false, setNotesOpen: () => {} });

// ─── Pinned element context ────────────────────────────────────────────────────
// Shared between SelectionPinButton (canvas) and DesignPanel (chat) so the
// user can pin any selected element and the AI receives its full prop snapshot.

interface PinnedElement {
  displayName: string;
  props: Record<string, any>;
  label: string;
  nodeId: string;
}

interface PinnedElementContextValue {
  pinned: PinnedElement | null;
  setPinned: (el: PinnedElement | null) => void;
}

const PinnedElementContext = createContext<PinnedElementContextValue>({
  pinned: null,
  setPinned: () => {},
});

// ─── History context ───────────────────────────────────────────────────────────
// Craft.js 0.2.x does not expose canUndo/canRedo on query or actions.
// We track history availability ourselves by watching for changes in the
// serialised node tree and gating undo/redo operations through shared handlers.
interface HistoryCtxValue {
  canUndo: boolean;
  canRedo: boolean;
  doUndo: () => void;
  doRedo: () => void;
}
const HistoryCtx = createContext<HistoryCtxValue>({
  canUndo: false, canRedo: false, doUndo: () => {}, doRedo: () => {},
});

// Must be rendered inside <Editor> so it can call useEditor.
function HistoryProvider({ children }: { children: ReactNode }) {
  const { actions } = useEditor(() => ({}));

  // Fingerprint covers both props and structure (child order, reparenting).
  // Sorting by id first so insertion order doesn't cause false positives.
  const { fingerprint } = useEditor((state) => ({
    fingerprint: Object.entries(state.nodes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) =>
        `${id}:${JSON.stringify(n.data.props)}:[${(n.data.nodes ?? []).join(",")}]`
      )
      .join("|"),
  }));

  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  // Flag set synchronously before calling undo/redo so the resulting snapshot
  // change is not counted as a new "real" edit.
  const isUndoRedoRef = useRef(false);
  const prevFpRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevFpRef.current === null) {
      prevFpRef.current = fingerprint;
      return;
    }
    if (fingerprint !== prevFpRef.current) {
      prevFpRef.current = fingerprint;
      if (!isUndoRedoRef.current) {
        // A real user edit — push onto history, clear redo stack.
        setUndoDepth(d => d + 1);
        setRedoDepth(0);
      }
      isUndoRedoRef.current = false;
    }
  }, [fingerprint]);

  // Use refs so the callbacks below don't need to be recreated when depth changes.
  const undoDepthRef = useRef(undoDepth);
  const redoDepthRef = useRef(redoDepth);
  undoDepthRef.current = undoDepth;
  redoDepthRef.current = redoDepth;

  const doUndo = useCallback(() => {
    if (undoDepthRef.current <= 0) return; // nothing to undo — leave isUndoRedoRef clean
    isUndoRedoRef.current = true;
    (actions as any).history?.undo?.();
    setUndoDepth(d => Math.max(0, d - 1));
    setRedoDepth(d => d + 1);
  }, [actions]);

  const doRedo = useCallback(() => {
    if (redoDepthRef.current <= 0) return; // nothing to redo — leave isUndoRedoRef clean
    isUndoRedoRef.current = true;
    (actions as any).history?.redo?.();
    setUndoDepth(d => d + 1);
    setRedoDepth(d => Math.max(0, d - 1));
  }, [actions]);

  const value = useMemo(() => ({
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
    doUndo,
    doRedo,
  }), [undoDepth, redoDepth, doUndo, doRedo]);

  return <HistoryCtx.Provider value={value}>{children}</HistoryCtx.Provider>;
}

// ─── Notes panel ─────────────────────────────────────────────────────────────

interface NotesPanelProps {
  notes: string;
  editable: boolean;
  onNotesChange?: (notes: string) => void;
}

function NotesPanel({ notes, editable, onNotesChange }: NotesPanelProps) {
  const { notesOpen, setNotesOpen } = useContext(NotesContext);
  const [localNotes, setLocalNotes] = useState(notes);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync when the prop changes (e.g. on initial load)
  useEffect(() => { setLocalNotes(notes); }, [notes]);

  const handleChange = (value: string) => {
    setLocalNotes(value);
    if (!onNotesChange) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { onNotesChange(value); }, 600);
  };

  if (!notesOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-[300px] z-30 flex flex-col bg-background border-l border-border shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <StickyNote className="w-3.5 h-3.5 text-primary" />
        <span className="text-[12px] font-semibold text-foreground flex-1">Notes</span>
        <button
          onClick={() => setNotesOpen(false)}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Close notes"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-3 min-h-0">
        {editable ? (
          <textarea
            value={localNotes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Add design notes, decisions, or handoff context here…"
            className="flex-1 w-full text-[12px] leading-relaxed bg-transparent resize-none border-none outline-none text-foreground placeholder:text-muted-foreground/50"
            spellCheck
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {localNotes ? (
              <p className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap">{localNotes}</p>
            ) : (
              <p className="text-[12px] text-muted-foreground/50 italic">No notes have been added to this design.</p>
            )}
          </div>
        )}
      </div>

      {editable && (
        <div className="px-3 py-2 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground/50">Notes save automatically as you type.</p>
        </div>
      )}
    </div>
  );
}

// ─── Canvas toolbar ───────────────────────────────────────────────────────────

function CanvasToolbar({ zoom, onZoomIn, onZoomOut, onFitView }: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onFitView: () => void }) {
  const { actions, query } = useEditor(() => ({}));
  const { canUndo, canRedo, doUndo, doRedo } = useContext(HistoryCtx);
  const { toast } = useToast();

  const { selectedArtboardId } = useEditor((state) => {
    const sel = state.events.selected;
    const id = sel && sel.size > 0 ? Array.from(sel)[0] : null;
    if (!id) return { selectedArtboardId: null };
    const node = state.nodes[id];
    const isArtboard = node?.data?.displayName === "AstryxArtboard";
    return { selectedArtboardId: isArtboard ? id : null };
  });

  const addArtboard = useCallback(() => {
    try {
      const serialized = query.serialize();
      const state: Record<string, any> = serialized ? JSON.parse(serialized) : {};

      if (!state["ROOT"]) {
        console.warn("[addArtboard] ROOT not found in serialized state");
        return;
      }

      const artboards = Object.values(state).filter(
        (n: any) => n?.type?.resolvedName === "AstryxArtboard"
      ) as any[];

      let newX = 64;
      let newY = 64;
      if (artboards.length > 0) {
        let maxRight = 0;
        let yAtMax = 64;
        for (const ab of artboards) {
          const abX = Number(ab.props?.x) || 64;
          const abW = Number(ab.props?.width) || 390;
          const edge = abX + abW;
          if (edge > maxRight) {
            maxRight = edge;
            yAtMax = Number(ab.props?.y) || 64;
          }
        }
        newX = maxRight + 80;
        newY = yAtMax;
      }

      const count = artboards.length + 1;
      const newId = `artboard-${Date.now()}`;

      state[newId] = {
        type: { resolvedName: "AstryxArtboard" },
        isCanvas: true,
        props: {
          label: `Screen ${count}`,
          direction: "column",
          gap: 16,
          padding: 24,
          x: newX,
          y: newY,
        },
        displayName: "AstryxArtboard",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      };

      const rootNodes = Array.isArray(state["ROOT"].nodes) ? [...state["ROOT"].nodes] : [];
      state["ROOT"] = { ...state["ROOT"], nodes: [...rootNodes, newId] };

      actions.deserialize(JSON.stringify(state));
    } catch (err) {
      console.error("[addArtboard] Failed:", err);
    }
    setTimeout(onFitView, 50);
  }, [actions, query, onFitView]);

  const duplicateArtboard = useCallback(() => {
    if (!selectedArtboardId) return;
    try {
      const serialized = query.serialize();
      const state: Record<string, any> = serialized ? JSON.parse(serialized) : {};
      const result = cloneSubtreeInState(state, selectedArtboardId);
      if (!result) return;
      actions.deserialize(JSON.stringify(result.newState));
    } catch (err) {
      console.error("[duplicateArtboard] Failed:", err);
    }
  }, [actions, query, selectedArtboardId]);

  const deleteArtboard = useCallback(() => {
    if (!selectedArtboardId) return;
    deleteArtboardFromEditor(actions, query, selectedArtboardId);
  }, [actions, query, selectedArtboardId]);

  const [importOpen, setImportOpen] = useState(false);
  const handleImportResult = useCallback((craftStateStr: string) => {
    try {
      // Repair before validation and pass the repaired result downstream so the
      // canvas never receives a state with dangling refs or a missing ROOT.
      const { state: repairedImport, report } = repairCraftStateWithReport(
        applyContrastColors(JSON.parse(craftStateStr)),
      );
      const parsed = repairedImport as Record<string, unknown>;
      const validation = validateCraftState(parsed);
      if (!validation.valid) {
        const hint = describeValidationError(validation.errors);
        console.error("[ImportDesign] Invalid craft state — canvas unchanged:", hint);
        toast({ title: "Import failed", description: `Couldn't import that design — ${hint} Try a different file or image.`, variant: "destructive" });
        setImportOpen(false);
        return;
      }
      let fullExisting: Record<string, unknown> = {};
      try { fullExisting = JSON.parse(query.serialize()); } catch {}
      const merged = mergeIntoCanvas(fullExisting, parsed);
      const spread = spreadArtboardsInState(merged, fullExisting);
      actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
      const substitutions = describeSubstitutions(report).trim();
      if (substitutions) {
        toast({ title: "Imported with placeholders", description: substitutions });
      }
    } catch (err) {
      console.error("[ImportDesign] Failed to apply:", err);
    }
    setImportOpen(false);
    setTimeout(onFitView, 80);
  }, [actions, query, onFitView]);

  return (
    <div className="h-9 shrink-0 border-b border-border bg-background flex items-center px-3 gap-1.5 z-10">
      <button
        onClick={addArtboard}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-border"
        title="Add artboard"
      >
        + Artboard
      </button>
      {selectedArtboardId && (
        <>
          <button
            onClick={duplicateArtboard}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-border"
            title="Duplicate artboard (Ctrl+D)"
          >
            ⧉ Duplicate
          </button>
          <button
            onClick={deleteArtboard}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-destructive/30"
            title="Delete artboard"
          >
            <Trash2 size={10} />
            Delete
          </button>
        </>
      )}
      <button
        onClick={() => setImportOpen(true)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-border"
        title="Import design from screenshot or Figma"
      >
        <Upload size={10} />
        Import
      </button>
      <ImportDesignModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportResult}
        currentCraftState={(() => { try { return skeletonizeCraftState(query.serialize() ?? '') ?? undefined; } catch { return undefined; } })()}
      />
      <div className="flex-1" />
      <div className="flex items-center gap-0.5 mr-1.5">
        <button
          onClick={doUndo}
          disabled={!canUndo}
          className="w-6 h-6 flex items-center justify-center text-[11px] rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          onClick={doRedo}
          disabled={!canRedo}
          className="w-6 h-6 flex items-center justify-center text-[11px] rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>
      </div>
      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground border border-border rounded-lg px-1 bg-background">
        <button
          onClick={onZoomOut}
          className="w-5 h-6 flex items-center justify-center hover:text-foreground transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <span className="w-10 text-center font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          onClick={onZoomIn}
          className="w-5 h-6 flex items-center justify-center hover:text-foreground transition-colors"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Clipboard & node operation utilities ────────────────────────────────────

/** Module-level clipboard. Stores one or more cloned subtrees ready for paste. */
let _craftClipboard: { subtree: Record<string, any>; rootId: string }[] | null = null;

// ─── Multi-select state ───────────────────────────────────────────────────────
// Craft's native multi-selection (Shift+Click, configured via the Editor's
// `handlers` prop) is the single source of truth. MultiSelectHandler mirrors
// `state.events.selected` into the shared multiSelectStore ref so module-level
// keyboard handlers AND resolver.tsx (multi-artboard group drag) can read the
// full id list synchronously. See ./multiSelectStore.ts.

/** BFS-collect all node IDs in a serialized craft subtree. */
function collectSubtreeIds(state: Record<string, any>, rootId: string): string[] {
  const ids: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    ids.push(id);
    const node = state[id];
    if (!node) continue;
    for (const c of (node.nodes ?? [])) queue.push(c as string);
    for (const v of Object.values(node.linkedNodes ?? {})) queue.push(v as string);
  }
  return ids;
}

/** Deep-clone a subtree from a serialized state, assigning fresh IDs throughout. */
/** Monotonic counter guaranteeing clone-ID uniqueness even when multiple
 *  subtrees are extracted within the same millisecond (multi-select copy). */
let _cloneSeq = 0;

function extractNodeSubtree(
  state: Record<string, any>,
  nodeId: string,
): { subtree: Record<string, any>; newRootId: string } {
  const allIds = collectSubtreeIds(state, nodeId);
  const batch = `${Date.now()}-${++_cloneSeq}`;
  const idMap: Record<string, string> = {};
  allIds.forEach((id, i) => { idMap[id] = `node-${batch}-${i}`; });
  const subtree: Record<string, any> = {};
  for (const id of allIds) {
    const node = JSON.parse(JSON.stringify(state[id]));
    if (Array.isArray(node.nodes)) node.nodes = node.nodes.map((c: string) => idMap[c] ?? c);
    if (node.linkedNodes && typeof node.linkedNodes === "object") {
      const r: Record<string, string> = {};
      for (const [k, v] of Object.entries(node.linkedNodes)) r[k] = idMap[v as string] ?? (v as string);
      node.linkedNodes = r;
    }
    // Remap parent for non-root descendants; root's parent is fixed on insert.
    if (id !== nodeId && node.parent && idMap[node.parent]) node.parent = idMap[node.parent];
    subtree[idMap[id]] = node;
  }
  return { subtree, newRootId: idMap[nodeId] };
}

/** Insert a cloned subtree into state as a child of targetParentId.
 *  insertAfterIndex = -1 appends to end. */
function insertSubtreeInState(
  state: Record<string, any>,
  subtree: Record<string, any>,
  newRootId: string,
  targetParentId: string,
  insertAfterIndex: number,
): Record<string, any> {
  const parent = JSON.parse(JSON.stringify(state[targetParentId]));
  const siblings: string[] = parent.nodes ?? [];
  const insertAt = insertAfterIndex < 0 ? siblings.length : insertAfterIndex + 1;
  siblings.splice(insertAt, 0, newRootId);
  parent.nodes = siblings;
  const rootNode = { ...subtree[newRootId], parent: targetParentId };
  return { ...state, ...subtree, [newRootId]: rootNode, [targetParentId]: parent };
}

/** Duplicate nodeId in-place: clone + insert immediately after original. */
function duplicateNodeInState(
  state: Record<string, any>,
  nodeId: string,
): Record<string, any> | null {
  if (!nodeId || nodeId === "ROOT") return null;
  const node = state[nodeId];
  if (!node) return null;
  const parentId: string = node.parent;
  if (!parentId) return null;
  const { subtree, newRootId } = extractNodeSubtree(state, nodeId);
  const idx = (state[parentId]?.nodes ?? []).indexOf(nodeId);
  return insertSubtreeInState(state, subtree, newRootId, parentId, idx);
}

/** Swap nodeId one position up or down in its parent's nodes array. */
function moveNodeInParent(
  state: Record<string, any>,
  nodeId: string,
  direction: "up" | "down",
): Record<string, any> | null {
  if (!nodeId || nodeId === "ROOT") return null;
  const node = state[nodeId];
  if (!node) return null;
  const parentId: string = node.parent;
  if (!parentId) return null;
  const parent = state[parentId];
  const siblings: string[] = [...(parent?.nodes ?? [])];
  const idx = siblings.indexOf(nodeId);
  if (idx === -1) return null;
  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= siblings.length) return null;
  [siblings[idx], siblings[newIdx]] = [siblings[newIdx], siblings[idx]];
  return { ...state, [parentId]: { ...parent, nodes: siblings } };
}

/**
 * Move nodeId to targetParentId at targetIndex, removing it from wherever
 * it currently lives. Handles both intra- and inter-parent reordering.
 */
function reorderNodeInParent(
  state: Record<string, any>,
  nodeId: string,
  targetParentId: string,
  targetIndex: number,
): Record<string, any> | null {
  if (!nodeId || nodeId === "ROOT") return null;
  const node = state[nodeId];
  if (!node || !state[targetParentId]) return null;
  const srcParentId: string = node.parent;
  if (!srcParentId) return null;

  let next = { ...state };

  // Remove from source parent.
  const srcParent = { ...next[srcParentId] };
  srcParent.nodes = (srcParent.nodes ?? []).filter((id: string) => id !== nodeId);
  next[srcParentId] = srcParent;

  // Insert into target parent at the requested index.
  const tgtParent = { ...next[targetParentId] };
  const tgtNodes = (tgtParent.nodes ?? []).filter((id: string) => id !== nodeId);
  const clampedIdx = Math.max(0, Math.min(targetIndex, tgtNodes.length));
  tgtNodes.splice(clampedIdx, 0, nodeId);
  tgtParent.nodes = tgtNodes;
  next[targetParentId] = tgtParent;

  // Update the node's parent reference if it moved.
  if (srcParentId !== targetParentId) {
    next[nodeId] = { ...next[nodeId], parent: targetParentId };
  }

  // When a node is reparented to ROOT from a non-ROOT parent, its existing x/y
  // props are artboard-relative (or meaningless) and will cause it to appear at
  // an unexpected location in global canvas space.  Compute a sensible placement
  // below the lowest artboard so the node is immediately visible and selectable.
  if (targetParentId === "ROOT" && srcParentId !== "ROOT") {
    // Find the bottom edge of every artboard on the canvas.
    let maxBottom = 64;
    let bestX = 64;
    for (const [, n] of Object.entries(next)) {
      if ((n as any)?.type?.resolvedName !== "AstryxArtboard") continue;
      const ab = n as any;
      const ax: number = ab.props?.x ?? 64;
      const ay: number = ab.props?.y ?? 64;
      // Artboard height can be auto; fall back to a generous default.
      const ah: number = typeof ab.props?.height === "number" ? ab.props.height : 800;
      const bottom = ay + ah;
      if (bottom > maxBottom) { maxBottom = bottom; bestX = ax; }
    }
    const updatedNode = { ...next[nodeId] };
    updatedNode.props = { ...(updatedNode.props ?? {}), x: bestX, y: maxBottom + 48 };
    next[nodeId] = updatedNode;
  }

  return next;
}

/** Copy a node's subtree to the module-level clipboard. Returns true on success. */
function copyNodeToClipboard(state: Record<string, any>, nodeId: string): boolean {
  if (!nodeId || nodeId === "ROOT" || !state[nodeId]) return false;
  const { subtree, newRootId } = extractNodeSubtree(state, nodeId);
  _craftClipboard = [{ subtree, rootId: newRootId }];
  return true;
}

/** Copy multiple node subtrees to the clipboard (for multi-select copy/cut). */
function copyNodesToClipboard(state: Record<string, any>, nodeIds: string[]): boolean {
  const entries: { subtree: Record<string, any>; rootId: string }[] = [];
  for (const nodeId of nodeIds) {
    if (!nodeId || nodeId === "ROOT" || !state[nodeId]) continue;
    const { subtree, newRootId } = extractNodeSubtree(state, nodeId);
    entries.push({ subtree, rootId: newRootId });
  }
  if (entries.length === 0) return false;
  _craftClipboard = entries;
  return true;
}

/**
 * Delete a set of node IDs (plus their full subtrees) from the serialized craft
 * state in one shot. Skips ROOT and nodes that no longer exist.
 *
 * Corruption-safe: the BFS uses a visited set to guard against cycles, skips
 * missing child IDs silently (broken refs), and detaches the top-level targets
 * from ROOT.nodes by ID regardless of the node's own `parent` field (so a
 * wrong/null parent cannot prevent removal from ROOT).
 */
function deleteNodesFromState(
  state: Record<string, any>,
  nodeIds: string[],
): Record<string, any> {
  // Collect every descendant ID for each target so we can remove them all.
  // Guard against cycles with a visited set and silently skip missing refs.
  const allToRemove = new Set<string>();
  for (const id of nodeIds) {
    if (!id || id === "ROOT" || !state[id]) continue;
    const queue = [id];
    while (queue.length) {
      const curr = queue.shift()!;
      if (allToRemove.has(curr)) continue; // cycle guard
      allToRemove.add(curr);
      const node = state[curr];
      if (!node) continue; // missing ref — skip silently
      for (const c of (node.nodes ?? [])) {
        if (typeof c === "string" && !allToRemove.has(c)) queue.push(c);
      }
      for (const v of Object.values(node.linkedNodes ?? {})) {
        if (typeof v === "string" && !allToRemove.has(v)) queue.push(v);
      }
    }
  }
  if (allToRemove.size === 0) return state;

  // Detach top-level targets from their parents' nodes arrays.
  // Primary: use the node's declared `parent` field.
  // Fallback: always scrub ROOT.nodes directly so a wrong/null `parent` cannot
  // leave a stale reference in ROOT when deleting artboards.
  let newState = { ...state };
  const targetSet = new Set(nodeIds.filter((id) => allToRemove.has(id)));
  for (const id of nodeIds) {
    const node = newState[id];
    const parentId: string | null = node?.parent ?? null;
    if (parentId && newState[parentId]) {
      const parent = { ...newState[parentId] };
      parent.nodes = (parent.nodes ?? []).filter((n: string) => !allToRemove.has(n));
      newState[parentId] = parent;
    }
  }
  // Always scrub ROOT.nodes as well — handles cases where `parent` is wrong or null.
  if (newState["ROOT"] && Array.isArray(newState["ROOT"].nodes)) {
    const rootBefore: string[] = newState["ROOT"].nodes;
    const rootAfter = rootBefore.filter((n: string) => !targetSet.has(n));
    if (rootAfter.length !== rootBefore.length) {
      newState["ROOT"] = { ...newState["ROOT"], nodes: rootAfter };
    }
  }

  // Remove every collected node from the state map.
  for (const id of Array.from(allToRemove)) {
    const { [id]: _removed, ...rest } = newState;
    newState = rest;
  }
  return newState;
}

/** Delete an artboard as a complete serialised graph mutation. Craft.js rejects
 * raw delete() for some top-level canvas graphs; deserialize preserves the
 * invariant and records the operation in editor history for undo.
 *
 * Corruption-safe: runs repairCraftState on the serialised state first so that
 * orphaned artboards (parent=ROOT but absent from ROOT.nodes) are reattached
 * and artboards with broken internal refs are cleaned up before the subtree BFS
 * runs. After repair the artboard is guaranteed to be findable and removable
 * even if the original state was inconsistent. */
function deleteArtboardFromEditor(
  actions: { deserialize: (state: string) => void },
  query: { serialize: () => string },
  artboardId: string,
): void {
  try {
    // Repair before delete: reattaches orphaned nodes and strips dangling refs
    // so that the BFS in deleteNodesFromState always operates on a consistent
    // graph, even if the design was saved during a bug window.
    const rawState = JSON.parse(query.serialize()) as Record<string, any>;
    const state = repairCraftState(rawState) as Record<string, any>;
    if (state[artboardId]?.type?.resolvedName !== "AstryxArtboard") return;
    actions.deserialize(JSON.stringify(deleteNodesFromState(state, [artboardId])));
  } catch (err) {
    console.error("[deleteArtboard] Failed:", err);
  }
}

/** Paste clipboard subtrees as siblings of selectedId (or children of ROOT).
 *
 * Artboard clipboard entries are always pasted as top-level siblings under
 * ROOT, offset 40 px right and 40 px down from their original position so
 * the copies are immediately visible beside the originals.
 *
 * Component (non-artboard) entries use the existing sibling-insertion logic. */
function pasteFromClipboard(
  state: Record<string, any>,
  selectedId: string | null,
): Record<string, any> | null {
  if (!_craftClipboard) return null;
  const entries = Array.isArray(_craftClipboard) ? _craftClipboard : [_craftClipboard];

  // Split clipboard into artboard vs component entries based on the root node's resolvedName.
  const artboardEntries: typeof entries = [];
  const componentEntries: typeof entries = [];
  for (const entry of entries) {
    const rootNode = entry.subtree[entry.rootId];
    if (rootNode?.type?.resolvedName === "AstryxArtboard") {
      artboardEntries.push(entry);
    } else {
      componentEntries.push(entry);
    }
  }

  let currentState = state;

  // ── Paste artboards under ROOT with a 40 px offset ─────────────────────
  if (artboardEntries.length > 0) {
    currentState = pasteArtboardsInState(currentState, artboardEntries, 40, 40);
  }

  // ── Paste components via the original sibling-insertion logic ───────────
  if (componentEntries.length > 0) {
    let targetParentId: string;
    let insertAfterIdx: number;
    if (!selectedId || selectedId === "ROOT") {
      targetParentId = "ROOT";
      insertAfterIdx = -1;
    } else {
      const selNode = currentState[selectedId];
      if (!selNode) { targetParentId = "ROOT"; insertAfterIdx = -1; }
      else {
        targetParentId = selNode.parent ?? "ROOT";
        const siblings: string[] = currentState[targetParentId]?.nodes ?? [];
        insertAfterIdx = siblings.indexOf(selectedId);
      }
    }
    if (currentState[targetParentId]) {
      for (const entry of componentEntries) {
        const { subtree: srcSubtree, rootId: srcRootId } = entry;
        const { subtree, newRootId } = extractNodeSubtree(srcSubtree, srcRootId);
        if (!currentState[targetParentId]) break;
        const next = insertSubtreeInState(currentState, subtree, newRootId, targetParentId, insertAfterIdx);
        if (!next) continue;
        currentState = next;
        const siblings: string[] = currentState[targetParentId]?.nodes ?? [];
        insertAfterIdx = siblings.indexOf(newRootId);
      }
    }
  }

  return currentState === state ? null : currentState;
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

function KeyboardHandler() {
  const { actions, query, selectedId, selectedIsArtboard } = useEditor((state) => {
    const sel = state.events.selected;
    const id = sel && sel.size > 0 ? Array.from(sel)[0] : null;
    const node = id ? state.nodes[id] : null;
    return {
      selectedId: id,
      selectedIsArtboard: node?.data?.displayName === "AstryxArtboard",
    };
  });
  const { doUndo, doRedo } = useContext(HistoryCtx);
  const doUndoRef  = useRef(doUndo);
  const doRedoRef  = useRef(doRedo);
  doUndoRef.current = doUndo;
  doRedoRef.current = doRedo;
  // Stable refs so the single-mount effect always reads current values.
  const queryRef        = useRef(query);    queryRef.current        = query;
  const actionsRef      = useRef(actions);  actionsRef.current      = actions;
  const selectedIdRef   = useRef(selectedId);      selectedIdRef.current   = selectedId;
  const isArtboardRef   = useRef(selectedIsArtboard); isArtboardRef.current = selectedIsArtboard;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const inInput = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || !!el?.isContentEditable;
      const id = selectedIdRef.current;
      const isArtboard = isArtboardRef.current;
      const multiIds = _multiSelRef.current;
      const isMulti = multiIds.size > 1;

      // ── Helpers to resolve the effective target set ───────────────────────
      /** All valid non-ROOT IDs from the multi-select set (or single selection).
       *  Artboards ARE now included so multi-select can act on them. */
      const resolveAllTargets = (state: Record<string, any>): string[] => {
        const candidates = isMulti ? Array.from(multiIds) : (id ? [id] : []);
        return candidates.filter(nid => !(!nid || nid === "ROOT" || !state[nid]));
      };

      /** Non-ROOT, non-artboard IDs only — for component-specific actions (cut). */
      const resolveComponentTargets = (state: Record<string, any>): string[] => {
        return resolveAllTargets(state).filter(
          nid => state[nid]?.type?.resolvedName !== "AstryxArtboard",
        );
      };

      // ── Delete / Backspace ────────────────────────────────────────────────
      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        if (isMulti) {
          e.preventDefault();
          try {
            const raw = JSON.parse(queryRef.current.serialize());
            const s = repairCraftState(raw) as Record<string, any>;
            const targets = resolveAllTargets(s);
            if (targets.length === 0) return;
            const next = deleteNodesFromState(s, targets);
            actionsRef.current.deserialize(JSON.stringify(next));
            actionsRef.current.selectNode(undefined as any);
            _multiSelRef.current = new Set();
            publishMultiSelection(_multiSelRef.current);
          } catch (err) { console.error("[multi-delete]", err); }
          return;
        }
        if (!id || id === "ROOT") return;
        e.preventDefault();
        if (isArtboard) {
          deleteArtboardFromEditor(actionsRef.current, queryRef.current, id);
        } else {
          actionsRef.current.delete(id);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !inInput) {
        const k = e.key.toLowerCase();

        // ── Copy ─────────────────────────────────────────────────────────────
        if (k === "c") {
          if (!id && !isMulti) return;
          e.preventDefault();
          try {
            const s = JSON.parse(queryRef.current.serialize());
            if (isMulti) {
              // Copy all targets — artboards and components alike
              const targets = resolveAllTargets(s);
              copyNodesToClipboard(s, targets);
            } else {
              if (!id || id === "ROOT") return;
              copyNodeToClipboard(s, id);
            }
          } catch (err) { console.error("[copy]", err); }
          return;
        }

        // ── Cut — artboards excluded (cut-delete is destructive; prefer Ctrl+X on components)
        if (k === "x") {
          e.preventDefault();
          try {
            const s = JSON.parse(queryRef.current.serialize());
            if (isMulti) {
              // Cut only non-artboard nodes; artboards stay (no accidental mass-delete)
              const targets = resolveComponentTargets(s);
              if (targets.length === 0) return;
              if (copyNodesToClipboard(s, targets)) {
                const next = deleteNodesFromState(s, targets);
                actionsRef.current.deserialize(JSON.stringify(next));
                actionsRef.current.selectNode(undefined as any);
                _multiSelRef.current = new Set();
                publishMultiSelection(_multiSelRef.current);
              }
            } else {
              if (!id || id === "ROOT" || isArtboard) return;
              if (copyNodeToClipboard(s, id)) actionsRef.current.delete(id);
            }
          } catch (err) { console.error("[cut]", err); }
          return;
        }

        // ── Paste ─────────────────────────────────────────────────────────────
        if (k === "v") {
          e.preventDefault();
          try {
            const s = JSON.parse(queryRef.current.serialize());
            const next = pasteFromClipboard(s, id);
            if (next) actionsRef.current.deserialize(JSON.stringify(next));
          } catch (err) { console.error("[paste]", err); }
          return;
        }

        // ── Undo / Redo ───────────────────────────────────────────────────────
        if (k === "z" && !e.shiftKey) { e.preventDefault(); doUndoRef.current(); return; }
        if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); doRedoRef.current(); return; }

        // ── Duplicate — single node only ──────────────────────────────────────
        if (k === "d") {
          if (!id || id === "ROOT") return;
          e.preventDefault();
          try {
            const s = JSON.parse(queryRef.current.serialize());
            if (isArtboard) {
              const result = cloneSubtreeInState(s, id);
              if (result) actionsRef.current.deserialize(JSON.stringify(result.newState));
            } else {
              const next = duplicateNodeInState(s, id);
              if (next) actionsRef.current.deserialize(JSON.stringify(next));
            }
          } catch (err) { console.error("[duplicate]", err); }
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []); // all values read via refs — mount once

  return null;
}

// ─── Multi-select mirror (Shift+Click via craft's native handlers) ──────────
// Craft's own event handlers manage the multi-selection (the Editor's
// `handlers` prop rebinds `isMultiSelectEnabled` to Shift). Each selected node
// renders its own SELECTION_RING via `node.events.selected`, so no extra
// outline styling is needed here — this component only mirrors the selection
// set to module-level state for keyboard handlers and inspector subscribers.
function MultiSelectHandler() {
  const { craftSelectedIds } = useEditor((state) => ({
    craftSelectedIds: Array.from(state.events.selected ?? []),
  }));

  const key = craftSelectedIds.join("|");
  useEffect(() => {
    const next = new Set(craftSelectedIds);
    _multiSelRef.current = next;
    publishMultiSelection(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}

// ─── Canvas selection hints (shown over the canvas) ──────────────────────────

function CanvasHints() {
  return null;
}

// ─── Canvas right-click context menu ─────────────────────────────────────────

/** Reusable button row for context menus. */
function CtxItem({ label, shortcut, onClick, disabled, danger }: {
  label: string; shortcut?: string; onClick?: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      className={`w-full text-left px-3 py-[5px] flex items-center justify-between gap-4 transition-colors text-[12px]
        ${disabled
          ? "text-muted-foreground/50 cursor-default"
          : danger
          ? "text-destructive hover:bg-accent"
          : "hover:bg-accent"
        }`}
      onMouseDown={disabled ? (e) => e.preventDefault() : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span>{label}</span>
      {shortcut && <span className="shrink-0 text-muted-foreground text-[10px]">{shortcut}</span>}
    </button>
  );
}

/**
 * Shows a context menu on right-click anywhere inside the canvas area
 * (the div marked data-canvas-area="true").  Exposes Duplicate, Copy, Cut,
 * Paste, Move layer up/down, and Delete for the currently selected node.
 */
function CanvasContextMenu() {
  const { actions, query, selectedId, selectedIsArtboard, siblingIndex, siblingCount } = useEditor((state) => {
    const sel = state.events.selected;
    const id  = sel && sel.size > 0 ? Array.from(sel)[0] : null;
    const node = id ? state.nodes[id] : null;
    const parentId   = node?.data?.parent as string | undefined ?? null;
    const parentNode = parentId ? state.nodes[parentId] : null;
    const siblings: string[] = (parentNode?.data?.nodes as string[]) ?? [];
    return {
      selectedId:        id,
      selectedIsArtboard: node?.data?.displayName === "AstryxArtboard",
      siblingIndex:      id ? siblings.indexOf(id) : -1,
      siblingCount:      siblings.length,
    };
  });

  const [menu, setMenu] = useState<{
    x: number; y: number; nodeId: string; isArtboard: boolean;
    siblingIndex: number; siblingCount: number; hasClip: boolean;
  } | null>(null);

  // Stable refs so effect callbacks always read current values.
  const queryRef      = useRef(query);   queryRef.current   = query;
  const actionsRef    = useRef(actions); actionsRef.current = actions;
  const selectedIdRef = useRef(selectedId); selectedIdRef.current = selectedId;
  const isArtboardRef = useRef(selectedIsArtboard); isArtboardRef.current = selectedIsArtboard;
  const sibIdxRef     = useRef(siblingIndex); sibIdxRef.current = siblingIndex;
  const sibCntRef     = useRef(siblingCount); sibCntRef.current = siblingCount;

  // Listen for right-clicks inside the canvas area (marked data-canvas-area).
  useEffect(() => {
    const handleCtx = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest("[data-canvas-area]")) return;

      // Prefer the craft node actually under the cursor (craft only selects on
      // left-click, so the selectedId ref may lag behind the right-clicked element).
      const el = (e.target as HTMLElement | null)?.closest("[data-id]") as HTMLElement | null;
      const clickedNodeId = el?.getAttribute("data-id");
      const id = (clickedNodeId && clickedNodeId !== "ROOT")
        ? clickedNodeId
        : selectedIdRef.current;

      if (!id || id === "ROOT") return;
      e.preventDefault();

      // Compute sibling info fresh from the serialized state so we never use
      // a stale React ref value (refs only update after a re-render, which
      // hasn't happened yet for a right-click on a newly hovered element).
      let isArtboard = false;
      let sibIdx = -1;
      let sibCnt = 0;
      try {
        const s = JSON.parse(queryRef.current.serialize()) as Record<string, any>;
        const node = s[id];
        if (node) {
          isArtboard = node.displayName === "AstryxArtboard";
          const parentId: string | undefined = node.parent;
          if (parentId && s[parentId]) {
            const siblings: string[] = s[parentId].nodes ?? [];
            sibIdx = siblings.indexOf(id);
            sibCnt = siblings.length;
          }
        }
      } catch { /* fall through — all defaults are safe */ }

      // Keep craft's selection in sync with what the user right-clicked.
      if (id !== selectedIdRef.current) {
        actionsRef.current.selectNode(id);
      }

      setMenu({
        x: e.clientX, y: e.clientY, nodeId: id,
        isArtboard,
        siblingIndex: sibIdx,
        siblingCount: sibCnt,
        hasClip: !!_craftClipboard,
      });
    };
    window.addEventListener("contextmenu", handleCtx);
    return () => window.removeEventListener("contextmenu", handleCtx);
  }, []);

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("click",   close, { capture: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click",   close, { capture: true });
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (!menu) return null;

  const { nodeId: id, isArtboard, hasClip } = menu;
  const canDelete   = !isArtboard;
  const canMoveUp   = !isArtboard && menu.siblingIndex > 0;
  const canMoveDown = !isArtboard && menu.siblingIndex < menu.siblingCount - 1;

  const run = (op: () => void) => { setMenu(null); op(); };
  const gs  = () => JSON.parse(queryRef.current.serialize()) as Record<string, any>;

  return (
    <div
      className="fixed z-[9999] min-w-[196px] rounded-md border border-border bg-popover shadow-lg py-1"
      style={{ top: menu.y, left: menu.x }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <CtxItem label="Duplicate" shortcut="⌘D" onClick={() => run(() => {
        try {
          const s = gs();
          const next = isArtboard ? cloneSubtreeInState(s, id)?.newState : duplicateNodeInState(s, id);
          if (next) actionsRef.current.deserialize(JSON.stringify(next));
        } catch (err) { console.error("[ctx] duplicate:", err); }
      })} />

      <div className="my-1 border-t border-border" />

      <CtxItem label="Copy"  shortcut="⌘C" onClick={() => run(() => {
        try { copyNodeToClipboard(gs(), id); } catch (err) { console.error("[ctx] copy:", err); }
      })} />
      {canDelete && <CtxItem label="Cut" shortcut="⌘X" onClick={() => run(() => {
        try { const s = gs(); if (copyNodeToClipboard(s, id)) actionsRef.current.delete(id); }
        catch (err) { console.error("[ctx] cut:", err); }
      })} />}
      <CtxItem label="Paste" shortcut="⌘V" disabled={!hasClip} onClick={hasClip ? () => run(() => {
        try {
          const s = gs();
          const next = pasteFromClipboard(s, id);
          if (next) actionsRef.current.deserialize(JSON.stringify(next));
        } catch (err) { console.error("[ctx] paste:", err); }
      }) : undefined} />

      {(canMoveUp || canMoveDown) && (
        <>
          <div className="my-1 border-t border-border" />
          <CtxItem label="Move layer up"   disabled={!canMoveUp}   onClick={canMoveUp ? () => run(() => {
            try { const s = gs(); const next = moveNodeInParent(s, id, "up");   if (next) actionsRef.current.deserialize(JSON.stringify(next)); }
            catch (err) { console.error("[ctx] move up:", err); }
          }) : undefined} />
          <CtxItem label="Move layer down" disabled={!canMoveDown} onClick={canMoveDown ? () => run(() => {
            try { const s = gs(); const next = moveNodeInParent(s, id, "down"); if (next) actionsRef.current.deserialize(JSON.stringify(next)); }
            catch (err) { console.error("[ctx] move down:", err); }
          }) : undefined} />
        </>
      )}

      {canDelete && (
        <>
          <div className="my-1 border-t border-border" />
          <CtxItem label="Delete" danger onClick={() => run(() => actionsRef.current.delete(id))} />
        </>
      )}
    </div>
  );
}

// ─── Selection pin button ─────────────────────────────────────────────────────
// Floats above the selected element (fixed-position, outside the canvas
// transform) so the user can pin the element to the AI chat for precise edits.

function SelectionPinButton() {
  const { setPinned } = useContext(PinnedElementContext);

  // Keep a live ref to the craft query so the rAF loop can always fetch the
  // latest DOM ref without re-running the effect on every re-render.
  const craftQueryRef = useRef<any>(null);

  const { selectedInfo } = useEditor((state, query) => {
    craftQueryRef.current = query;
    const sel = state.events.selected;
    const id = sel && sel.size > 0 ? Array.from(sel)[0] : null;
    if (!id || id === "ROOT") return { selectedInfo: null };
    const node = state.nodes[id];
    if (!node) return { selectedInfo: null };
    const dn = node.data.displayName as string;
    if (dn === "AstryxArtboard") return { selectedInfo: null };
    return {
      selectedInfo: {
        id,
        displayName: dn,
        props: { ...node.data.props } as Record<string, any>,
      },
    };
  });

  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    const id = selectedInfo?.id;
    if (!id) { setPos(null); return; }

    // Some nested elements (e.g. text inside a card inside an artboard) have a
    // null .dom ref at the moment the selection event fires because the element
    // hasn't finished mounting.  Poll via rAF until the ref is populated before
    // starting to track position, so the button always appears eventually.
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const node = craftQueryRef.current?.node(id).get?.();
      const dom: HTMLElement | null = node ? (node as any).dom : null;
      if (!dom) {
        // Not mounted yet – try again next frame.
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const rect = dom.getBoundingClientRect();
      setPos({ top: rect.top, right: window.innerWidth - rect.right });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); };
  // Re-run only when the selected node ID changes, not on every re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInfo?.id]);

  if (!selectedInfo || !pos) return null;

  const rawLabel = selectedInfo.props.children
    ?? selectedInfo.props.label
    ?? selectedInfo.props.placeholder
    ?? selectedInfo.props.title
    ?? selectedInfo.displayName;
  const label = String(rawLabel ?? selectedInfo.displayName);

  return (
    <div
      style={{
        position: "fixed",
        top: Math.max(4, pos.top - 34),
        right: Math.max(4, pos.right - 4),
        zIndex: 1000,
      }}
    >
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setPinned({ displayName: selectedInfo.displayName, props: selectedInfo.props, label, nodeId: selectedInfo.id })}
        className="flex items-center gap-1 bg-primary text-primary-foreground rounded-lg px-2 py-1 shadow-lg hover:bg-primary/90 active:scale-95 transition-all text-[10px] font-semibold"
        title="Pin this element to the AI chat"
      >
        <MessageCirclePlus className="w-3 h-3" />
        Ask AI
      </button>
    </div>
  );
}

// ─── Snap guide overlay ───────────────────────────────────────────────────────
// Rendered inside the canvas transformed div (canvas coordinate space).
// Updated imperatively via a module-level ref to avoid re-rendering the canvas.

const _snapGuideCallback = { current: null as ((h: number | null, v: number | null) => void) | null };
const _setSnapGuides = (h: number | null, v: number | null) => _snapGuideCallback.current?.(h, v);

function SnapGuideOverlay() {
  const hRef = useRef<HTMLDivElement>(null);
  const vRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    _snapGuideCallback.current = (h, v) => {
      if (hRef.current) {
        hRef.current.style.display = h !== null ? "block" : "none";
        if (h !== null) hRef.current.style.top = `${h}px`;
      }
      if (vRef.current) {
        vRef.current.style.display = v !== null ? "block" : "none";
        if (v !== null) vRef.current.style.left = `${v}px`;
      }
    };
    return () => { _snapGuideCallback.current = null; };
  }, []);

  return (
    <>
      <div
        ref={hRef}
        style={{
          display: "none",
          position: "absolute",
          top: 0,
          left: -9999,
          right: -9999,
          height: 1,
          background: "#93c5fd",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />
      <div
        ref={vRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          top: -9999,
          bottom: -9999,
          width: 1,
          background: "#93c5fd",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

// ─── Infinite canvas (pan + zoom) ────────────────────────────────────────────

function InfiniteCanvas({ children, zoom, onZoom, fitTrigger }: { children: ReactNode; zoom: number; onZoom: (updater: (z: number) => number) => void; fitTrigger?: number }) {
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const containerRef = useRef<HTMLDivElement>(null);
  const transformDivRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);
  const hasFitOnMount = useRef(false);

  const { actions: editorActions } = useEditor(() => ({}));
  const editorActionsRef = useRef(editorActions);
  editorActionsRef.current = editorActions;

  // Refs that mirror state/prop for use inside native event handlers (avoid stale closures).
  const panRef = useRef({ x: 80, y: 80 });
  const zoomRef = useRef(zoom);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Touch tracking refs for pointer-based pan / pinch-zoom.
  const touchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const touchPinchStartRef = useRef<{
    dist: number; midX: number; midY: number;
    panX: number; panY: number; zoom: number;
  } | null>(null);
  const touchPanStartRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // Access craft.js query to read artboard node positions from serialized state.
  const { query } = useEditor();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        spaceDown.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Native wheel handler — cursor-anchored zoom for all scroll/pinch events,
  // matching the workflow canvas behaviour exactly.
  // Uses the same exponential scaling as KiteFrameCanvas: exp(-deltaY * 0.00225 * 0.2).
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;

    const factor = Math.exp(-e.deltaY * 0.00045);
    const newZoom = Math.min(2, Math.max(0.25, currentZoom * factor));
    // Compute world-space point under the cursor and keep it fixed after zoom.
    const worldX = (e.clientX - rect.left - currentPan.x) / currentZoom;
    const worldY = (e.clientY - rect.top - currentPan.y) / currentZoom;
    const newPanX = e.clientX - rect.left - worldX * newZoom;
    const newPanY = e.clientY - rect.top - worldY * newZoom;

    // Update ref immediately so back-to-back wheel events see the latest values.
    panRef.current = { x: newPanX, y: newPanY };
    setPan({ x: newPanX, y: newPanY });
    onZoom(() => newZoom);
  }, [onZoom]); // panRef / zoomRef are refs — intentionally omitted from deps

  // Attach the wheel listener as non-passive so preventDefault() is honoured.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Prevent Safari's native pinch-zoom/rotate gestures conflicting with our handler.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('gesturechange', prevent, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
    };
  }, []);

  // ── Touch pointer handlers ──────────────────────────────────────────────────
  // Single-finger → pan.  Two-finger → pinch-zoom (midpoint-anchored).
  // Pen events are intentionally ignored so stylus work is unaffected.

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (_) {}
    touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const fingers = Array.from(touchPointersRef.current.values());
    if (fingers.length >= 2) {
      // Second finger down — switch to pinch mode.
      touchPanStartRef.current = null;
      const dist = Math.hypot(fingers[1].x - fingers[0].x, fingers[1].y - fingers[0].y);
      touchPinchStartRef.current = {
        dist: Math.max(dist, 1),
        midX: (fingers[0].x + fingers[1].x) / 2,
        midY: (fingers[0].y + fingers[1].y) / 2,
        panX: panRef.current.x,
        panY: panRef.current.y,
        zoom: zoomRef.current,
      };
      return;
    }

    // Single finger — prepare for pan.
    touchPinchStartRef.current = null;
    touchPanStartRef.current = {
      offsetX: e.clientX - panRef.current.x,
      offsetY: e.clientY - panRef.current.y,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const fingers = Array.from(touchPointersRef.current.values());

    // Pinch zoom (two fingers, midpoint-anchored).
    if (touchPinchStartRef.current && fingers.length >= 2) {
      if (!containerRef.current) return;
      const pinch = touchPinchStartRef.current;
      const dist = Math.hypot(fingers[1].x - fingers[0].x, fingers[1].y - fingers[0].y);
      const midX = (fingers[0].x + fingers[1].x) / 2;
      const midY = (fingers[0].y + fingers[1].y) / 2;
      const rect = containerRef.current.getBoundingClientRect();
      const newZoom = Math.min(2, Math.max(0.25, pinch.zoom * dist / pinch.dist));
      // Keep the world-space point that was under the initial pinch midpoint fixed.
      const midWorldX = (pinch.midX - rect.left - pinch.panX) / pinch.zoom;
      const midWorldY = (pinch.midY - rect.top - pinch.panY) / pinch.zoom;
      const newPanX = midX - rect.left - midWorldX * newZoom;
      const newPanY = midY - rect.top - midWorldY * newZoom;
      panRef.current = { x: newPanX, y: newPanY };
      setPan({ x: newPanX, y: newPanY });
      onZoom(() => newZoom);
      return;
    }

    // Single-finger pan.
    if (touchPanStartRef.current) {
      const newPan = {
        x: e.clientX - touchPanStartRef.current.offsetX,
        y: e.clientY - touchPanStartRef.current.offsetY,
      };
      panRef.current = newPan;
      setPan(newPan);
    }
  }, [onZoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    touchPointersRef.current.delete(e.pointerId);
    const remaining = touchPointersRef.current.size;
    if (remaining < 2) touchPinchStartRef.current = null;
    if (remaining === 0) touchPanStartRef.current = null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Background = outer container itself, the transform wrapper div (empty canvas space
    // between artboards), OR the ROOT section's own div (empty space below/right of
    // artboards). Artboards/components always bubble from a deeper target.
    const clickedBackground =
      e.target === e.currentTarget ||
      e.target === transformDivRef.current ||
      (e.target instanceof HTMLElement && e.target.dataset.canvasRoot === "true");
    if (e.button === 0 && clickedBackground) {
      // Deselect any selected node when the user clicks empty canvas space.
      editorActionsRef.current.selectNode(undefined as any);
    }
    if (e.button === 1 || spaceDown.current || (e.button === 0 && clickedBackground)) {
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // Parse all AstryxArtboard bounding boxes (canvas-unit coordinates) from the
  // current craft.js serialized state. Returns null when no artboards exist.
  const getArtboardBounds = useCallback((): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    try {
      const serialized = query.serialize();
      if (!serialized) return null;
      const state = JSON.parse(serialized) as Record<string, any>;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let found = false;
      for (const node of Object.values(state)) {
        if (node?.type?.resolvedName === "AstryxArtboard") {
          const x = Number(node.props?.x) || 64;
          const y = Number(node.props?.y) || 64;
          const w = Number(node.props?.width) || 390;
          // Use explicit height prop when set; otherwise assume a typical mobile
          // screen aspect ratio (≈ 2:1 h/w) as a best-effort estimate so the
          // fit is approximately correct even for content-sized artboards.
          const h = node.props?.height != null ? Number(node.props.height) : Math.round(w * 1.9);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
          found = true;
        }
      }
      return found ? { minX, minY, maxX, maxY } : null;
    } catch {
      return null;
    }
  }, [query]);

  // Centre all artboards in the visible canvas viewport at the largest zoom
  // level that fits them with 60 px padding on all sides.
  const fitToContent = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = getArtboardBounds();
    if (!bounds) {
      // No artboards yet — fall back to a sensible default position.
      setPan({ x: 80, y: 80 });
      onZoom(() => 0.75);
      return;
    }
    const { minX, minY, maxX, maxY } = bounds;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const { width: vpW, height: vpH } = container.getBoundingClientRect();
    if (vpW === 0 || vpH === 0) return; // container not yet laid out
    const pad = 60;
    const zoomFit = Math.min(
      (vpW - pad * 2) / contentW,
      (vpH - pad * 2) / contentH,
      1.5  // never zoom in further than 150 % to avoid jarring initial view
    );
    const clampedZoom = Math.max(0.25, Math.min(2, zoomFit));
    // Pan so the content bounding-box centre aligns with the viewport centre.
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    onZoom(() => clampedZoom);
    setPan({ x: vpW / 2 - centerX * clampedZoom, y: vpH / 2 - centerY * clampedZoom });
  }, [getArtboardBounds, onZoom]);

  // Auto-fit once after craft.js has hydrated the Frame on initial mount.
  // A 200 ms delay lets the Frame deserialise the craft state before we measure.
  useEffect(() => {
    if (hasFitOnMount.current) return;
    const timer = setTimeout(() => {
      hasFitOnMount.current = true;
      fitToContent();
    }, 200);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit whenever the toolbar "Fit View" button fires or a new artboard is added.
  useEffect(() => {
    if (fitTrigger && fitTrigger > 0) fitToContent();
  }, [fitTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--foreground) 15%, transparent) 1.5px, transparent 1.5px)",
        backgroundSize: "20px 20px",
        backgroundColor: "var(--muted)",
        // Disable native browser pan/zoom on touch so our pointer handlers take full control.
        touchAction: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        ref={transformDivRef}
        style={{
          position: "absolute",
          // minHeight (not height) ensures craft.js Frame has a measurable
          // container on first render, while still letting the div grow taller
          // than the viewport when artboards extend downward.
          minHeight: "100%",
          minWidth: "100%",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          // No pointer-events override here. Background-click detection is done
          // by checking e.target === transformDivRef.current in handleMouseDown.
        }}
      >
        <CanvasZoomContext.Provider value={zoom}>
          {children}
          <SnapGuideOverlay />
        </CanvasZoomContext.Provider>
      </div>

      {/* Canvas selection hints */}
      <CanvasHints />

      {/* Stacked zoom FABs */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={() => onZoom((z) => Math.min(2, z * 1.15))}
          className="w-7 h-7 bg-background border border-border rounded-xl shadow-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:shadow-md transition-all"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onZoom((z) => Math.max(0.15, z / 1.15))}
          className="w-7 h-7 bg-background border border-border rounded-xl shadow-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:shadow-md transition-all"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={fitToContent}
          className="w-7 h-7 bg-background border border-border rounded-xl shadow-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:shadow-md transition-all"
          title="Fit view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pan hint */}
      <div className="absolute bottom-4 left-4 text-[10px] text-muted-foreground/40 pointer-events-none select-none z-10">
        Scroll to zoom · Space+drag or drag background to pan · Pinch to zoom on touch
      </div>
    </div>
  );
}

// ─── AI drawer (right rail, collapsible) ─────────────────────────────────────

interface AIMessage {
  role: "ai" | "user";
  text: string;
  pinnedElement?: PinnedElement | null;
  imagePreview?: string;
  /** Stable identity, required to persist and to merge across tabs. */
  id?: string;
  /** Ordering key for the merge; assigned on first persist if absent. */
  timestamp?: Date;
  /** Inline card for a design this message produced. */
  designPreview?: DesignPreview;
}

// ─── Design chat persistence ─────────────────────────────────────────────────
//
// The panel's messages are stored in the shared transcript format rather than a
// bespoke one, so the generation exchange recorded by the home screen can be
// dropped straight into this thread and so both chats share one merge/cap
// implementation. `role` is the only field that needs translating.

let designMsgSeq = 0;
function nextDesignMessageId(): string {
  designMsgSeq += 1;
  return `dm-${Date.now()}-${designMsgSeq}`;
}

/**
 * Give every message a stable id and timestamp, preserving array order.
 *
 * Messages are appended from ~15 call sites as bare `{ role, text }` objects;
 * normalising here keeps those call sites untouched. Timestamps are forced to
 * increase so a batch appended within the same millisecond cannot be reordered
 * by the chronological merge.
 */
function normalizeDesignMessages(list: AIMessage[]): AIMessage[] {
  let changed = false;
  let last = 0;
  const out = list.map((m) => {
    const existing = m.timestamp?.getTime();
    if (m.id && existing !== undefined) {
      last = Math.max(last, existing);
      return m;
    }
    const ts = Math.max(last + 1, existing ?? Date.now());
    last = ts;
    changed = true;
    return { ...m, id: m.id ?? nextDesignMessageId(), timestamp: new Date(ts) };
  });
  return changed ? out : list;
}

function toTranscriptEntries(messages: AIMessage[]): TranscriptEntry[] {
  return messages
    .filter((m) => !!m.id)
    .map((m) => ({
      id: m.id!,
      role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
      content: m.text,
      timestamp: m.timestamp ?? new Date(),
      ...(m.pinnedElement ? { pinnedElement: m.pinnedElement } : {}),
      ...(m.imagePreview ? { imagePreview: m.imagePreview } : {}),
      ...(m.designPreview ? { designPreview: m.designPreview } : {}),
    }));
}

function fromTranscriptEntries(entries: TranscriptEntry[]): AIMessage[] {
  return entries.map((e) => ({
    id: e.id,
    role: e.role === "user" ? ("user" as const) : ("ai" as const),
    text: typeof e.content === "string" ? e.content : "",
    timestamp: e.timestamp,
    pinnedElement: (e as any).pinnedElement ?? null,
    imagePreview: typeof (e as any).imagePreview === "string" ? (e as any).imagePreview : undefined,
    designPreview: e.designPreview,
  }));
}

/** True when two threads are the same messages in the same order. */
function sameDesignThread(a: AIMessage[], b: AIMessage[]): boolean {
  return a.length === b.length && a.every((m, i) => m.id === b[i]?.id);
}

/**
 * Graph-aware merge for craft.js node maps.
 * After a shallow merge, walks every node's children array and removes
 * references to IDs that no longer exist in the merged map, preventing
 * orphan-reference errors when the AI patch doesn't include all siblings.
 */
function mergeGraphAware(
  existingState: Record<string, unknown>,
  patchNodes: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existingState, ...patchNodes };
  const nodeIds = new Set(Object.keys(merged));

  for (const [nodeId, node] of Object.entries(merged)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if (!Array.isArray(n.nodes)) continue;

    const before = n.nodes as string[];
    const after = before.filter((childId) => {
      if (!nodeIds.has(childId)) {
        console.warn(`[mergeGraphAware] Removing orphan child ref "${childId}" from node "${nodeId}"`);
        return false;
      }
      return true;
    });

    if (after.length !== before.length) {
      merged[nodeId] = { ...n, nodes: after };
    }
  }

  return merged;
}

export function getUntouchedDefaultArtboardId(state: Record<string, unknown>): string | undefined {
  const root = state["ROOT"] as Record<string, unknown> | undefined;
  const rootNodes = Array.isArray(root?.nodes) ? root.nodes as string[] : [];
  if (rootNodes.length !== 1) return undefined;
  const id = rootNodes[0];
  const artboard = state[id] as Record<string, unknown> | undefined;
  if ((artboard?.type as any)?.resolvedName !== "AstryxArtboard") return undefined;
  const props = artboard?.props as Record<string, unknown> | undefined;
  const children = Array.isArray(artboard?.nodes) ? artboard.nodes : [];
  return children.length === 0 && props?.label === "Screen 1" ? id : undefined;
}

/** Applies a first-generation result onto the canvas's pristine default
 * artboard instead of preserving it as an unused empty screen. */
export function reuseUntouchedDefaultArtboard(
  existingState: Record<string, unknown>,
  incomingState: Record<string, unknown>,
): Record<string, unknown> {
  const defaultId = getUntouchedDefaultArtboardId(existingState);
  if (!defaultId) return mergeIntoCanvas(existingState, incomingState);

  const incomingRoot = incomingState["ROOT"] as Record<string, unknown> | undefined;
  const incomingRootNodes = Array.isArray(incomingRoot?.nodes) ? incomingRoot.nodes as string[] : [];
  const incomingArtboardId = incomingRootNodes.find((id) =>
    (incomingState[id] as any)?.type?.resolvedName === "AstryxArtboard"
  );
  if (!incomingArtboardId) return mergeIntoCanvas(existingState, incomingState);

  const incomingArtboard = incomingState[incomingArtboardId] as Record<string, any>;
  const remap = new Map<string, string>([[incomingArtboardId, defaultId]]);
  const result: Record<string, any> = {};
  for (const [id, node] of Object.entries(incomingState)) {
    const nextId = remap.get(id) ?? id;
    const copy = JSON.parse(JSON.stringify(node)) as Record<string, any>;
    if (Array.isArray(copy.nodes)) copy.nodes = copy.nodes.map((childId: string) => remap.get(childId) ?? childId);
    if (typeof copy.parent === "string") copy.parent = remap.get(copy.parent) ?? copy.parent;
    result[nextId] = copy;
  }
  const defaultArtboard = existingState[defaultId] as Record<string, any>;
  result[defaultId] = {
    ...defaultArtboard,
    ...incomingArtboard,
    parent: "ROOT",
    props: { ...defaultArtboard.props, ...incomingArtboard.props },
  };
  const resultRoot = result["ROOT"] as Record<string, any>;
  result["ROOT"] = {
    ...resultRoot,
    nodes: incomingRootNodes.map((id) => remap.get(id) ?? id),
  };
  return { ...existingState, ...result };
}

/**
 * Additively merges an incoming full craft.js state (e.g. from image import or
 * an AI full-state response) into the existing canvas so that artboards the user
 * already built are preserved alongside the new ones.
 *
 * Key difference from mergeGraphAware (which is for PATCH responses):
 * - Both existing and incoming states include a ROOT node. A plain object spread
 *   would overwrite ROOT with the incoming ROOT whose `nodes` array only references
 *   the new artboard, making existing artboards unreachable from ROOT.
 * - Here we union ROOT.nodes instead of overwriting it.
 * - All other nodes: incoming wins for shared IDs (correct for modifications —
 *   e.g. AI regenerates an artboard with the same ID, it should replace it).
 */
/**
 * Re-assign every node ID in an incoming craft state to a fresh random ID so
 * it cannot collide with IDs that already exist on the canvas. ROOT is the
 * fixed craft.js canvas root and is intentionally left unchanged.
 *
 * Remaps ALL node ID references consistently:
 *   - Object keys (the node IDs themselves)
 *   - `nodes[]` child-reference arrays
 *   - `parent` field
 *   - `linkedNodes` value map
 *
 * Without this, uploading a second image would overwrite the first screen:
 * the AI always generates the same fixed IDs ("artboard-1", "container-1",
 * …), so `{ ...existingState, ...incoming }` silently replaces the first
 * import's nodes, and Set-deduplication on ROOT.nodes collapses the two
 * artboard references back to one.
 */
function reIdIncomingNodes(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const ts = Date.now();

  // Build old-id → new-id map for every key except ROOT
  const idMap: Record<string, string> = {};
  let i = 0;
  for (const key of Object.keys(state)) {
    if (key === "ROOT") continue;
    idMap[key] =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `node-${ts}-${i++}`;
  }

  const remapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(state)) {
    const newKey = key === "ROOT" ? "ROOT" : (idMap[key] ?? key);

    if (!value || typeof value !== "object") {
      remapped[newKey] = value;
      continue;
    }

    // Deep-clone so we don't mutate the original parsedRaw
    const node = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

    // Remap nodes[] child references
    if (Array.isArray(node.nodes)) {
      node.nodes = (node.nodes as string[]).map((c) => idMap[c] ?? c);
    }

    // Remap parent (ROOT stays "ROOT" since ROOT is excluded from idMap)
    if (typeof node.parent === "string") {
      node.parent = idMap[node.parent] ?? node.parent;
    }

    // Remap linkedNodes value map
    if (node.linkedNodes && typeof node.linkedNodes === "object") {
      const ln = node.linkedNodes as Record<string, string>;
      const remappedLn: Record<string, string> = {};
      for (const [slot, linkedId] of Object.entries(ln)) {
        remappedLn[slot] = idMap[linkedId] ?? linkedId;
      }
      node.linkedNodes = remappedLn;
    }

    remapped[newKey] = node;
  }

  return remapped;
}

function mergeIntoCanvas(
  existingState: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existingState, ...incoming };

  const existingRoot = existingState["ROOT"] as Record<string, unknown> | undefined;
  const incomingRoot = incoming["ROOT"] as Record<string, unknown> | undefined;
  if (existingRoot && incomingRoot) {
    const existingRootNodes = Array.isArray(existingRoot.nodes) ? (existingRoot.nodes as string[]) : [];
    const incomingRootNodes = Array.isArray(incomingRoot.nodes) ? (incomingRoot.nodes as string[]) : [];
    const combined = Array.from(new Set([...existingRootNodes, ...incomingRootNodes]));
    merged["ROOT"] = { ...incomingRoot, nodes: combined };
  }

  const nodeIds = new Set(Object.keys(merged));
  for (const [nodeId, node] of Object.entries(merged)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if (!Array.isArray(n.nodes)) continue;
    const before = n.nodes as string[];
    const after = before.filter((childId) => {
      if (!nodeIds.has(childId)) {
        console.warn(`[mergeIntoCanvas] Removing orphan child ref "${childId}" from node "${nodeId}"`);
        return false;
      }
      return true;
    });
    if (after.length !== before.length) {
      merged[nodeId] = { ...n, nodes: after };
    }
  }

  // Promote any node whose `parent` field is "ROOT" but that is absent from
  // ROOT.nodes — this happens when the AI generates a state with a correctly-
  // parented artboard but forgets to list it in ROOT's nodes array.
  const rootEntry = merged["ROOT"] as Record<string, unknown> | undefined;
  if (rootEntry && Array.isArray(rootEntry.nodes)) {
    const rootNodeSet = new Set(rootEntry.nodes as string[]);
    const promoted: string[] = [];
    for (const [id, node] of Object.entries(merged)) {
      if (id === "ROOT" || !node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (n.parent === "ROOT" && !rootNodeSet.has(id)) {
        promoted.push(id);
        console.warn(`[mergeIntoCanvas] Promoting orphaned ROOT child: "${id}"`);
      }
    }
    if (promoted.length > 0) {
      merged["ROOT"] = { ...rootEntry, nodes: [...(rootEntry.nodes as string[]), ...promoted] };
    }
  }

  return merged;
}

/**
 * After an AI rewrite, carry forward user-typed `cellData` and `headers` for
 * every AstryxTable node that appears (by the same ID) in both the old and new
 * state — protecting data that the user typed manually from being silently
 * erased by an unrelated layout change.
 *
 * Pass `targetNodeId` when the user explicitly asked the AI to edit a specific
 * node (e.g. via "Ask AI" with a pinned selection). That node is excluded from
 * preservation so the AI's new values take effect; all other tables are still
 * protected.
 */
function preserveTableCellData(
  existingState: Record<string, any>,
  newState: Record<string, any>,
  targetNodeId?: string,
): Record<string, any> {
  const result: Record<string, any> = { ...newState };
  for (const [nodeId, node] of Object.entries(result)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if ((n.type as any)?.resolvedName !== "AstryxTable") continue;

    // Skip preservation for the node the user explicitly targeted — the AI's
    // new headers/cellData values should win.
    if (targetNodeId && nodeId === targetNodeId) continue;

    const existing = existingState[nodeId];
    if (!existing || typeof existing !== "object") continue;
    const e = existing as Record<string, unknown>;
    if ((e.type as any)?.resolvedName !== "AstryxTable") continue;

    const existingProps = e.props as Record<string, unknown> | undefined;
    if (!existingProps) continue;

    const existingCellData = existingProps.cellData;
    const existingHeaders = existingProps.headers;
    if (existingCellData === undefined && existingHeaders === undefined) continue;

    const newProps = (n.props as Record<string, unknown> | undefined) ?? {};

    // Warn when preservation is actually overwriting AI-generated values so
    // the override is visible in the browser console even without server logs.
    const aiCellData = newProps.cellData;
    const aiHeaders = newProps.headers;
    const overwritingCellData = existingCellData !== undefined && aiCellData !== undefined && JSON.stringify(aiCellData) !== JSON.stringify(existingCellData);
    const overwritingHeaders = existingHeaders !== undefined && aiHeaders !== undefined && JSON.stringify(aiHeaders) !== JSON.stringify(existingHeaders);
    if (overwritingCellData || overwritingHeaders) {
      // logging disabled
    }

    const updated: Record<string, unknown> = { ...newProps };
    if (existingCellData !== undefined) updated.cellData = existingCellData;
    if (existingHeaders !== undefined) updated.headers = existingHeaders;

    result[nodeId] = { ...n, props: updated };
  }
  return result;
}

/**
 * Clones an artboard subtree with fresh node IDs.
 * Returns { newState, newArtboardId } where newState is the updated craft.js
 * node map with all cloned nodes inserted and ROOT.nodes updated.
 * Positions the clone to the right of all existing artboards.
 */
function cloneSubtreeInState(
  state: Record<string, any>,
  artboardId: string,
): { newState: Record<string, any>; newArtboardId: string } | null {
  const artboard = state[artboardId];
  if (!artboard || artboard?.type?.resolvedName !== "AstryxArtboard") return null;

  // Collect all descendant node IDs (BFS)
  const allIds: string[] = [];
  const queue: string[] = [artboardId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    allIds.push(id);
    const node = state[id];
    if (!node) continue;
    for (const childId of (node.nodes ?? [])) queue.push(childId);
    for (const linkedId of Object.values(node.linkedNodes ?? {})) queue.push(linkedId as string);
  }

  // Build ID remap
  const ts = Date.now();
  const idMap: Record<string, string> = {};
  allIds.forEach((id, i) => {
    idMap[id] = id === artboardId ? `artboard-${ts}` : `node-${ts}-${i}`;
  });
  const newArtboardId = idMap[artboardId];

  // Deep-clone each node with remapped IDs
  const clonedNodes: Record<string, any> = {};
  for (const id of allIds) {
    const node = JSON.parse(JSON.stringify(state[id]));
    node.parent = id === artboardId ? "ROOT" : (idMap[node.parent] ?? node.parent);
    if (Array.isArray(node.nodes)) node.nodes = node.nodes.map((c: string) => idMap[c] ?? c);
    if (node.linkedNodes && typeof node.linkedNodes === "object") {
      const remapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(node.linkedNodes)) remapped[k] = idMap[v as string] ?? (v as string);
      node.linkedNodes = remapped;
    }
    clonedNodes[idMap[id]] = node;
  }

  // Position clone to the right of all artboards
  const allArtboards = Object.values(state).filter((n: any) => n?.type?.resolvedName === "AstryxArtboard") as any[];
  let maxRight = 64;
  for (const ab of allArtboards) {
    const edge = (Number(ab.props?.x) || 64) + (Number(ab.props?.width) || 390);
    if (edge > maxRight) maxRight = edge;
  }
  const srcLabel: string = artboard.props?.label ?? "Artboard";
  clonedNodes[newArtboardId].props = {
    ...clonedNodes[newArtboardId].props,
    x: maxRight + 80,
    y: Number(artboard.props?.y) || 64,
    label: `${srcLabel} Copy`,
  };

  const rootNodes = Array.isArray(state["ROOT"]?.nodes) ? state["ROOT"].nodes : [];
  const newState = {
    ...state,
    ...clonedNodes,
    ROOT: { ...state["ROOT"], nodes: [...rootNodes, newArtboardId] },
  };
  return { newState, newArtboardId };
}

/**
 * Diffs two craft.js node maps and returns which nodes were added, modified
 * (props changed), or removed. Used for `[design_ai_applied]` console logging.
 * Logs component types and node IDs only — never logs prop content.
 */
function diffCraftStates(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): {
  added: Array<{ nodeId: string; resolvedName: string }>;
  modified: Array<{ nodeId: string; resolvedName: string }>;
  removed: Array<{ nodeId: string; resolvedName: string }>;
} {
  const getResolvedName = (node: unknown): string =>
    (node && typeof node === "object" ? ((node as any).type?.resolvedName as string) : undefined) ?? "unknown";

  const added: Array<{ nodeId: string; resolvedName: string }> = [];
  const modified: Array<{ nodeId: string; resolvedName: string }> = [];
  const removed: Array<{ nodeId: string; resolvedName: string }> = [];

  for (const [nodeId, node] of Object.entries(after)) {
    const resolvedName = getResolvedName(node);
    if (!(nodeId in before)) {
      added.push({ nodeId, resolvedName });
    } else {
      const beforeProps = (before[nodeId] as any)?.props;
      const afterProps = (node as any)?.props;
      if (JSON.stringify(beforeProps) !== JSON.stringify(afterProps)) {
        modified.push({ nodeId, resolvedName });
      }
    }
  }
  for (const [nodeId, node] of Object.entries(before)) {
    if (!(nodeId in after)) {
      removed.push({ nodeId, resolvedName: getResolvedName(node) });
    }
  }
  return { added, modified, removed };
}

function spreadArtboardsInState(
  state: Record<string, any>,
  existingState?: Record<string, any>,
): Record<string, any> {
  const artboardEntries = Object.entries(state).filter(
    ([, n]: [string, any]) => n?.type?.resolvedName === "AstryxArtboard"
  );

  if (existingState) {
    // Patch mode: only position new artboards; preserve user-moved positions of existing ones.
    const existingArtboardIds = new Set(
      Object.keys(existingState).filter(
        (id) => (existingState[id] as any)?.type?.resolvedName === "AstryxArtboard"
      )
    );
    const newArtboards = artboardEntries.filter(([id]) => !existingArtboardIds.has(id));
    if (newArtboards.length === 0) return state;

    // Find rightmost edge & baseline Y from existing artboards in the merged state.
    const existingInMerged = artboardEntries.filter(([id]) => existingArtboardIds.has(id));
    let maxRight = 64;
    let baseY = 64;
    if (existingInMerged.length > 0) {
      // Use the leftmost existing artboard's Y as the row baseline.
      const leftmost = existingInMerged.reduce((best, cur) =>
        (Number((cur[1] as any).props?.x) || 0) < (Number((best[1] as any).props?.x) || 0) ? cur : best
      );
      baseY = Number((leftmost[1] as any).props?.y) || 64;
      for (const [, node] of existingInMerged) {
        const x = Number((node as any).props?.x) || 0;
        const w = Number((node as any).props?.width) || 390;
        maxRight = Math.max(maxRight, x + w);
      }
    }

    const result = { ...state };
    let curX = maxRight + 80;
    for (const [id, node] of newArtboards) {
      const width = Number((node as any).props?.width) || 390;
      result[id] = { ...(node as any), props: { ...(node as any).props, x: curX, y: baseY } };
      curX += width + 80;
    }
    return result;
  } else {
    // Full replace mode: lay all artboards out left-to-right from x=64.
    if (artboardEntries.length < 2) return state;
    artboardEntries.sort(([, a]: [string, any], [, b]: [string, any]) =>
      (Number(a.props?.x) || 0) - (Number(b.props?.x) || 0)
    );
    const result = { ...state };
    let curX = 64;
    const baseY = Number(artboardEntries[0][1].props?.y) || 64;
    for (const [id, node] of artboardEntries) {
      const width = Number(node.props?.width) || 390;
      result[id] = { ...node, props: { ...node.props, x: curX, y: baseY } };
      curX += width + 80;
    }
    return result;
  }
}

function describeValidationError(errors: string[]): string {
  if (!errors || errors.length === 0) return "unknown structural issue.";
  const first = errors[0];
  if (first.includes("non-existent parent")) return "it referenced a node that doesn't exist on your canvas.";
  if (first.includes("non-existent child")) return "it produced an inconsistent node tree.";
  if (first.includes("ROOT")) return "the generated design was missing its root structure.";
  // NOT "an unrecognised component type": the validator does not reject unknown
  // component *names* at all — repairCraftState swaps those for a labelled
  // placeholder before we get here. The only type error it can raise is a node
  // that carries no type whatsoever.
  if (first.includes("resolvedName")) return "one of its elements arrived with no component type at all.";
  return first.slice(0, 120) + ".";
}

/**
 * Full user-facing explanation for a generation that genuinely could not be
 * applied.
 *
 * By the time validation runs, repair has already backfilled missing types,
 * degraded unknown components to placeholders, stripped dangling references and
 * synthesised a missing ROOT. Anything still failing is a structural fault in
 * the model's output, so "try rephrasing" is bad advice — the user's wording was
 * never the problem. Re-running the generation is what actually helps.
 */
function describeValidationFailure(errors: string[]): string {
  return `${describeValidationError(errors)} That's a fault in the generated structure rather than your wording — asking again usually clears it.`;
}

function friendlyComponentName(name: string): string {
  return name.replace(/^Astryx/, "");
}

/**
 * Names the components the repair pass had to replace with placeholders, and
 * points at the closest thing the user could ask for instead.
 *
 * Returns "" when nothing was substituted, so callers can append it
 * unconditionally to a success message.
 */
function describeSubstitutions(report: CraftRepairReport | undefined): string {
  if (!report) return "";
  const names = report.substitutedComponents;
  const typeless = report.typelessNodeIds.length;
  const sentences: string[] = [];

  if (names.length > 0) {
    const shown = names.slice(0, 3);
    const extra = names.length - shown.length;
    const list =
      shown.map(friendlyComponentName).join(", ") + (extra > 0 ? ` and ${extra} more` : "");
    const plural = names.length > 1;
    sentences.push(
      `${list} ${plural ? "aren't" : "isn't"} in the Astryx library, so I left ${
        plural ? "labelled placeholders" : "a labelled placeholder"
      } on the canvas.`,
    );

    const suggestions = shown
      .map((n) => {
        const alt = suggestAlternativeComponent(n);
        return alt ? `${friendlyComponentName(n)} → ${friendlyComponentName(alt)}` : null;
      })
      .filter((s): s is string => s !== null);
    if (suggestions.length > 0) {
      sentences.push(
        `Closest available: ${suggestions.join(", ")} — ask me to swap ${
          suggestions.length > 1 ? "them" : "it"
        } in.`,
      );
    }
  }

  if (typeless > 0) {
    sentences.push(
      `${typeless} element${typeless === 1 ? "" : "s"} came back malformed and ${
        typeless === 1 ? "is" : "are"
      } shown as ${typeless === 1 ? "a placeholder" : "placeholders"} too.`,
    );
  }

  return sentences.length > 0 ? " " + sentences.join(" ") : "";
}

const INITIAL_MESSAGES: AIMessage[] = [
  {
    // Fixed id and epoch timestamp: the greeting must dedupe against itself
    // across reloads and always sort to the top of the thread.
    id: "design-welcome",
    timestamp: new Date(0),
    role: "ai",
    text: "Hi! I can add components to your artboards or modify existing ones — just describe what you want. If you ask for something outside the Astryx component library I'll let you know and suggest an alternative.",
  },
];

// ─── Design panel (unified right rail: KiteAI · Layers · Notes) ──────────────

/**
 * Compact inline card for a design a message produced.
 *
 * Deliberately narrower than the project chat's version: this rail is ~320px
 * and there is no "open design" action, because the design being previewed is
 * the one already on screen.
 */
function DesignChatPreviewCard({ preview }: { preview: DesignPreview }) {
  const { designId, title, screenLabels = [] } = preview;
  const count = screenLabels.length;
  return (
    <div
      className="mt-2 border border-border/70 rounded-lg overflow-hidden bg-background/60"
      data-testid={`design-chat-preview-${designId}`}
    >
      {/* No preview image: at this size it could only show a cropped band of
          the first screen, which told the user less than the screen list does. */}
      <div className="p-2">
        <div className="text-[11px] font-medium truncate">{title ?? "Generated design"}</div>
        {count > 0 && (
          <>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {count} screen{count === 1 ? "" : "s"}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {screenLabels.slice(0, 4).map((label, i) => (
                <span
                  key={`${label}-${i}`}
                  className="inline-block px-1.5 py-0.5 text-[9px] rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {label}
                </span>
              ))}
              {count > 4 && (
                <span className="inline-block px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  +{count - 4} more
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type DesignPanelTab = "kite-ai" | "layers";

const DESIGN_PANEL_COLLAPSED_KEY = "kiteframe-design-panel-collapsed";
const DESIGN_PANEL_ACTIVE_TAB_KEY = "kiteframe-design-panel-active-tab";
const DESIGN_PANEL_WIDTH_KEY = "kiteframe-design-panel-width";

interface DesignPanelProps {
  notes: string;
  editable: boolean;
  onNotesChange?: (notes: string) => void;
  /** Identity for the conversation. Without it the chat cannot be persisted. */
  designId?: string;
  /** Owner check for claiming a pre-project generation exchange. */
  currentUserId?: string | null;
}

function DesignPanel({ notes, editable, onNotesChange, designId, currentUserId }: DesignPanelProps) {
  const { actions, query, selectedNodeId } = useEditor((state) => ({
    selectedNodeId: state.events.selected ? Array.from(state.events.selected)[0] : undefined,
  }));

  const { pinned, setPinned } = useContext(PinnedElementContext);

  const [activeTab, setActiveTab] = useState<DesignPanelTab>(() => {
    try {
      const s = localStorage.getItem(DESIGN_PANEL_ACTIVE_TAB_KEY);
      return (s === "kite-ai" || s === "layers") ? s : "kite-ai";
    } catch { return "kite-ai"; }
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem(DESIGN_PANEL_COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const s = localStorage.getItem(DESIGN_PANEL_WIDTH_KEY);
      return Math.max(280, Math.min(600, s ? parseInt(s) : 320));
    } catch { return 320; }
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<AIMessage[]>(() => {
    if (!designId) return INITIAL_MESSAGES;
    const stored = readDesignChat(designId);
    return stored.length > 0 ? fromTranscriptEntries(stored) : INITIAL_MESSAGES;
  });
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "error">("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Conversation persistence ───────────────────────────────────────────────
  //
  // Without this the thread lived only in component state: every reload, and
  // every unmount of the editor, silently discarded the whole conversation.

  // Which design the thread currently in `messages` belongs to. This is state,
  // not a ref, so it changes in the same commit as the messages themselves.
  //
  // It is what stops a design switch from writing the previous conversation
  // under the new design's key: when `designId` changes, React re-runs the
  // effects below with the NEW id but the OLD messages, because the reload has
  // not been applied yet. Every write is gated on the two agreeing.
  const [threadDesignId, setThreadDesignId] = useState<string | undefined>(designId);
  const threadIsCurrent = threadDesignId === designId;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const threadDesignIdRef = useRef(threadDesignId);
  threadDesignIdRef.current = threadDesignId;

  /** Merge the in-memory thread with storage and adopt the result. */
  const syncMessages = useCallback((id: string) => {
    // Only fold memory back in if memory actually holds this design's thread.
    if (threadDesignIdRef.current !== id) return;
    const normalized = normalizeDesignMessages(messagesRef.current);
    const merged = fromTranscriptEntries(saveDesignChat(id, toTranscriptEntries(normalized)));
    setMessages((current) => (sameDesignThread(current, merged) ? current : merged));
  }, []);

  // Assign ids/timestamps first (messages are pushed as bare objects), then
  // persist. saveDesignChat merges rather than overwrites, so a second tab open
  // on the same design cannot erase what this one added.
  useEffect(() => {
    if (!designId || !threadIsCurrent) return;
    const normalized = normalizeDesignMessages(messages);
    if (normalized !== messages) {
      setMessages(normalized);
      return;
    }
    saveDesignChat(designId, toTranscriptEntries(normalized));
  }, [messages, designId, threadIsCurrent]);

  // Claim the exchange that generated this design. The home screen creates a
  // design and navigates here before any chat exists, so the prompt, reply and
  // preview are stashed and adopted on arrival. Scoped to the generating user
  // and to this specific design so nothing can be misattributed.
  //
  // Declared before the reload effect so that on a design switch the adopted
  // exchange is already in storage by the time the new thread is read.
  useEffect(() => {
    if (!designId) return;
    const sync = () => syncMessages(designId);
    const adopted = adoptPendingDesignTranscript(designId, currentUserId ?? undefined);
    if (adopted.length > 0) sync();
    return subscribeDesignChat(designId, sync);
  }, [designId, currentUserId, syncMessages]);

  // Switching the panel to a different design loads that design's own thread.
  // Both state updates are batched, so `messages` and `threadDesignId` never
  // disagree in a committed render.
  useEffect(() => {
    if (threadIsCurrent) return;
    const stored = designId ? readDesignChat(designId) : [];
    setMessages(stored.length > 0 ? fromTranscriptEntries(stored) : INITIAL_MESSAGES);
    setThreadDesignId(designId);
  }, [designId, threadIsCurrent]);

  // ── Thinking phrases ───────────────────────────────────────────────────────
  const THINKING_PHRASES = [
    "thinking…",
    "concocting something…",
    "swirling the pot…",
    "consulting the design gods…",
    "sketching in the margins…",
    "pondering the pixels…",
    "rearranging the furniture…",
    "measuring twice…",
    "untangling the node graph…",
    "brewing ideas…",
    "weighing the options…",
    "adjusting the kerning…",
    "interrogating the layout…",
    "finding just the right shade…",
    "connecting the dots…",
    "having a design moment…",
    "channelling the muse…",
    "holding the vision…",
  ];
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const [thinkingVisible, setThinkingVisible] = useState(true);

  useEffect(() => {
    if (aiStatus !== "loading") { setThinkingIdx(0); setThinkingVisible(true); return; }
    // Cycle phrases: fade out → swap phrase → fade in → hold → repeat
    let idx = 0;
    const advance = () => {
      setThinkingVisible(false);
      setTimeout(() => {
        idx = (idx + 1) % THINKING_PHRASES.length;
        setThinkingIdx(idx);
        setThinkingVisible(true);
      }, 350); // fade-out duration before swap
    };
    const iv = setInterval(advance, 2200);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiStatus]);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const handleImageAttach = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setAttachedImage({ base64: dataUrl.split(",")[1], mimeType: file.type || "image/png", preview: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => { try { localStorage.setItem(DESIGN_PANEL_COLLAPSED_KEY, String(isCollapsed)); } catch {} }, [isCollapsed]);
  useEffect(() => { try { localStorage.setItem(DESIGN_PANEL_ACTIVE_TAB_KEY, activeTab); } catch {} }, [activeTab]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Auto-switch to KiteAI tab when something is pinned so the chip is visible.
  useEffect(() => { if (pinned) { setActiveTab("kite-ai"); setIsCollapsed(false); } }, [pinned]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const clamped = Math.max(280, Math.min(600, rect.left + rect.width - e.clientX));
      setPanelWidth(clamped);
      try { localStorage.setItem(DESIGN_PANEL_WIDTH_KEY, String(clamped)); } catch {}
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [isResizing]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (aiStatus === "loading") return;

    // ── Image attach path: import OR reference-edit based on prompt intent ───
    if (attachedImage) {
      const imageToSend = attachedImage;
      // A meaningful instruction (>10 chars) signals "use as reference to edit the canvas".
      // A short label or no text signals "import as a new screen" (original behaviour).
      const isReferenceEdit = trimmed.length > 10;
      setAttachedImage(null);
      setMessages((prev) => [
        ...prev,
        { role: "user", text: trimmed || "Import this design", imagePreview: imageToSend.preview },
      ]);
      setPrompt("");
      setAiStatus("loading");

      if (!isReferenceEdit) {
        // ── Original import path ─────────────────────────────────────────────
        try {
          let currentCraftState: string | undefined;
          try { currentCraftState = skeletonizeCraftState(query.serialize() ?? ''); } catch {}
          const res = await fetch("/api/ai/design-from-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: imageToSend.base64,
              mimeType: imageToSend.mimeType,
              frameLabel: trimmed || "Screen 1",
              currentCraftState,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Import failed");
          if (data.type === "message") {
            setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
          } else {
            // Repair before validation so minor AI ref issues (dangling children,
            // missing parent, absent ROOT) don't hard-fail the import.
            const repairedImport = (() => { try {
              const raw = applyContrastColors(JSON.parse(data.craftState));
              return raw ? repairCraftStateWithReport(raw) : null;
            } catch { return null; } })();
            const parsedRaw = repairedImport ? repairedImport.state as Record<string, unknown> : null;
            const importReport = repairedImport?.report;
            if (parsedRaw) {
              const validation = validateCraftState(parsedRaw);
              if (!validation.valid) {
                const hint = describeValidationError(validation.errors);
                setMessages((prev) => [...prev, { role: "ai", text: `I couldn't apply that image design — ${hint} Try again or use a clearer image.` }]);
              } else {
                let fullExisting: Record<string, unknown> = {};
                try { fullExisting = JSON.parse(query.serialize()); } catch {}
                // Re-ID all nodes in the incoming state so they never collide
                // with IDs already on the canvas. Without this, every image
                // import uses the same AI-generated IDs ("artboard-1", etc.),
                // causing the second upload to silently overwrite the first.
                const reId = reIdIncomingNodes(parsedRaw);
                const merged = mergeIntoCanvas(fullExisting, reId);
                const spread = spreadArtboardsInState(merged, fullExisting);
                // Validate the final merged+spread state before deserializing.
                // reIdIncomingNodes remaps all ID references (nodes[], parent,
                // linkedNodes) but a broken AI response could still produce
                // an invalid state — catch it here rather than loading corrupt
                // data into the canvas.
                // Repair the merged state and use the repaired version for both
                // validation and deserialise — so the canvas never loads dangling refs.
                const { state: repairedSpreadState, report: mergeReport } = repairCraftStateWithReport(spread);
                const repairedSpread = repairedSpreadState as Record<string, unknown>;
                const postMergeValidation = validateCraftState(repairedSpread);
                if (!postMergeValidation.valid) {
                  const hint = describeValidationFailure(postMergeValidation.errors);
                  setMessages((prev) => [...prev, { role: "ai", text: `I couldn't apply that image design — ${hint}` }]);
                } else {
                  actions.deserialize(sanitizeCraftState(JSON.stringify(repairedSpread)));
                  // The incoming state is repaired before the merge, so report
                  // that pass's substitutions plus anything the merge surfaced.
                  const note = describeSubstitutions(importReport) + describeSubstitutions(mergeReport);
                  setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Design imported from image.") + " ✓" + note }]);
                }
              }
            } else {
              setMessages((prev) => [...prev, { role: "ai", text: "I couldn't parse the image response. Try again or use a different image." }]);
            }
          }
          setAiStatus("idle");
        } catch (e: any) {
          setAiStatus("error");
          setMessages((prev) => [...prev, { role: "ai", text: `Import failed: ${e.message?.slice(0, 120) ?? "Unknown error"}` }]);
          setTimeout(() => setAiStatus("idle"), 3000);
        }
        return;
      }

      // ── Reference-edit path: image guides changes to existing canvas ─────
      try {
        let currentCraftState: string | undefined;
        let targetArtboardLabel: string | undefined;
        try {
          const serialized = query.serialize();
          if (serialized && serialized.length > 10) {
            currentCraftState = skeletonizeCraftState(serialized);
            const state = JSON.parse(serialized) as Record<string, unknown>;
            const artboardLabels = Object.values(state)
              .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
              .filter((n) => (n.type as any)?.resolvedName === "AstryxArtboard")
              .map((n) => (n.props as any)?.label as string | undefined)
              .filter((l): l is string => typeof l === "string" && l.length > 0);
            const lowerPrompt = trimmed.toLowerCase();
            const matched = artboardLabels.find((label) => lowerPrompt.includes(label.toLowerCase()));
            if (matched) {
              targetArtboardLabel = matched;
            } else if (artboardLabels.length === 1) {
              targetArtboardLabel = artboardLabels[0];
            } else if (selectedNodeId && artboardLabels.length > 1) {
              const findArtboardLabel = (nodeId: string): string | undefined => {
                const node = state[nodeId] as Record<string, unknown> | undefined;
                if (!node) return undefined;
                if ((node.type as any)?.resolvedName === "AstryxArtboard") {
                  return (node.props as any)?.label as string | undefined;
                }
                const parentId = node.parent as string | undefined;
                if (!parentId || parentId === nodeId) return undefined;
                return findArtboardLabel(parentId);
              };
              targetArtboardLabel = findArtboardLabel(selectedNodeId);
            }
          }
        } catch { /* ignore */ }

        const res = await fetch("/api/ai/design-edit-from-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: imageToSend.base64,
            mimeType: imageToSend.mimeType,
            prompt: trimmed,
            currentCraftState,
            targetArtboardLabel,
            selectedElement: pinned
              ? { displayName: pinned.displayName, props: pinned.props, nodeId: pinned.nodeId }
              : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reference edit failed");

        setPinned(null);

        if (data.type === "message") {
          setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
        } else if (data.type === "patch") {
          const patchNodes: Record<string, unknown> = JSON.parse(data.nodes);
          let existingState: Record<string, unknown> = {};
          try { existingState = JSON.parse(query.serialize()); } catch {}
          const mergedRaw = mergeGraphAware(existingState, patchNodes);
          // Repair and persist the repaired result — not just for validation.
          const { state: mergedState, report } = repairCraftStateWithReport(applyContrastColors(preserveTableCellData(existingState as Record<string, any>, mergedRaw as Record<string, any>, pinned?.nodeId)));
          const merged = mergedState as Record<string, unknown>;
          const validation = validateCraftState(merged);
          if (!validation.valid) {
            const hint = describeValidationFailure(validation.errors);
            setMessages((prev) => [...prev, { role: "ai", text: `${data.message ?? "I tried to update your design"} — but the result had an issue: ${hint}` }]);
          } else {
            const spread = spreadArtboardsInState(merged, existingState);
            actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
            setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Done! I've updated your canvas.") + " ✓" + describeSubstitutions(report) }]);
          }
        } else {
          const craftStateStr = data.craftState ?? data;
          const stateJson = typeof craftStateStr === "string" ? craftStateStr : JSON.stringify(craftStateStr);
          const parsedRaw = (() => { try { return applyContrastColors(JSON.parse(stateJson)); } catch { return null; } })();
          let fullExisting: Record<string, unknown> = {};
          try { fullExisting = JSON.parse(query.serialize()); } catch {}
          const parsedForValidationRaw = parsedRaw ? preserveTableCellData(fullExisting, parsedRaw, pinned?.nodeId) : null;
          const repaired = parsedForValidationRaw ? repairCraftStateWithReport(parsedForValidationRaw) : null;
          const parsedForValidation = repaired ? repaired.state as Record<string, unknown> : null;
          const validation = parsedForValidation ? validateCraftState(parsedForValidation) : { valid: false, errors: ["Failed to parse"] };
          if (!validation.valid) {
            const hint = describeValidationFailure(validation.errors);
            setMessages((prev) => [...prev, { role: "ai", text: `I couldn't apply that change — ${hint}` }]);
          } else {
            const mergedForApply = mergeIntoCanvas(fullExisting, parsedForValidation!);
            const spread = spreadArtboardsInState(mergedForApply, fullExisting);
            actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
            setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Done! I've updated your canvas to match the reference.") + " ✓" + describeSubstitutions(repaired?.report) }]);
          }
        }
        setAiStatus("idle");
      } catch (e: any) {
        setAiStatus("error");
        setMessages((prev) => [...prev, { role: "ai", text: `Reference edit failed: ${e.message?.slice(0, 120) ?? "Unknown error"}` }]);
        setTimeout(() => setAiStatus("idle"), 3000);
      }
      return;
    }

    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed, pinnedElement: pinned }]);
    setPrompt("");
    setAiStatus("loading");
    const aiStartMs = Date.now();
    try {
      let currentCraftState: string | undefined;
      let targetArtboardLabel: string | undefined;
      let reuseDefaultArtboard = false;
      try {
        const serialized = query.serialize();
        if (serialized && serialized.length > 10) {
          currentCraftState = skeletonizeCraftState(serialized);
          // Find artboard labels in the canvas and match them against the prompt
          // so the AI knows which screen to patch (e.g. "add a table to Screen 1")
          const state = JSON.parse(serialized) as Record<string, unknown>;
          reuseDefaultArtboard = !!getUntouchedDefaultArtboardId(state);
          const artboardLabels = Object.values(state)
            .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
            .filter((n) => (n.type as any)?.resolvedName === "AstryxArtboard")
            .map((n) => (n.props as any)?.label as string | undefined)
            .filter((l): l is string => typeof l === "string" && l.length > 0);
          const lowerPrompt = trimmed.toLowerCase();
          const matched = artboardLabels.find((label) => lowerPrompt.includes(label.toLowerCase()));
          if (matched) {
            targetArtboardLabel = matched;
          } else if (artboardLabels.length === 1) {
            // Only one artboard on the canvas — it must be the target
            targetArtboardLabel = artboardLabels[0];
          } else if (selectedNodeId && artboardLabels.length > 1) {
            // Walk up the parent chain of the selected node to find the nearest AstryxArtboard
            const findArtboardLabel = (nodeId: string): string | undefined => {
              const node = state[nodeId] as Record<string, unknown> | undefined;
              if (!node) return undefined;
              if ((node.type as any)?.resolvedName === "AstryxArtboard") {
                return (node.props as any)?.label as string | undefined;
              }
              const parentId = node.parent as string | undefined;
              if (!parentId || parentId === nodeId) return undefined;
              return findArtboardLabel(parentId);
            };
            targetArtboardLabel = findArtboardLabel(selectedNodeId);
          }
        }
      } catch { /* ignore */ }
      // Include prior conversation turns so the AI can reference previous context.
      // `messages` still reflects state before the current user turn was appended.
      const INITIAL_MSG_COUNT = INITIAL_MESSAGES.length;
      const conversationHistory = messages
        .slice(INITIAL_MSG_COUNT)
        .slice(-12)
        .map((m) => ({ role: m.role, text: m.text }));

      // Detect "new screen" intent: user wants a brand-new artboard, not an edit
      // of existing content. Only fires when a canvas already exists.
      // Uses detectNewScreenIntent which requires an explicit "new" qualifier and
      // suppresses the signal when the message references an existing artboard label.
      const hasExistingCanvas = !!currentCraftState && currentCraftState.trim().length > 2;
      const wantsNewScreen =
        hasExistingCanvas &&
        !pinned &&
        !reuseDefaultArtboard &&
        detectNewScreenIntent(trimmed, currentCraftState);

      const res = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          currentCraftState,
          targetArtboardLabel: wantsNewScreen ? undefined : targetArtboardLabel,
          conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
          selectedElement: pinned
            ? { displayName: pinned.displayName, props: pinned.props, nodeId: pinned.nodeId }
            : undefined,
          newScreen: wantsNewScreen || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Generation failed");

      setPinned(null);

      if (data.type === "message") {
        setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
      } else if (data.type === "patch") {
        const patchNodes: Record<string, unknown> = JSON.parse(data.nodes);
        let existingState: Record<string, unknown> = {};
        try { existingState = JSON.parse(query.serialize()); } catch {}
          const mergedRaw = reuseDefaultArtboard
            ? reuseUntouchedDefaultArtboard(existingState, patchNodes)
            : mergeGraphAware(existingState, patchNodes);
        // Repair and use the repaired result downstream.
        const { state: mergedState, report } = repairCraftStateWithReport(applyContrastColors(preserveTableCellData(existingState as Record<string, any>, mergedRaw as Record<string, any>, pinned?.nodeId)));
        const merged = mergedState as Record<string, unknown>;
        const validation = validateCraftState(merged);
        if (!validation.valid) {
          const hint = describeValidationFailure(validation.errors);
          setMessages((prev) => [...prev, { role: "ai", text: `${data.message ?? "I tried to update your design"} — but the result had an issue: ${hint}` }]);
        } else {
          const spread = spreadArtboardsInState(merged, existingState);
          actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
          const diff = diffCraftStates(existingState as Record<string, any>, merged as Record<string, any>);
          const totalChanges = diff.added.length + diff.modified.length + diff.removed.length;
          void diff; void totalChanges;
          setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Done! I've updated your canvas.") + " ✓" + describeSubstitutions(report) }]);
        }
      } else {
        const craftStateStr = data.craftState ?? data;
        const stateJson = typeof craftStateStr === "string" ? craftStateStr : JSON.stringify(craftStateStr);
        const parsedRaw = (() => { try { return applyContrastColors(JSON.parse(stateJson)); } catch { return null; } })();
        let fullExistingForReplace: Record<string, unknown> = {};
        try { fullExistingForReplace = JSON.parse(query.serialize()); } catch {}
        const parsedForValidationRaw = parsedRaw ? preserveTableCellData(fullExistingForReplace, parsedRaw, pinned?.nodeId) : null;
        const repaired = parsedForValidationRaw ? repairCraftStateWithReport(parsedForValidationRaw) : null;
        const parsedForValidation = repaired ? repaired.state as Record<string, unknown> : null;
        const validation = parsedForValidation ? validateCraftState(parsedForValidation) : { valid: false, errors: ["Failed to parse"] };
        if (!validation.valid) {
          const hint = describeValidationFailure(validation.errors);
          setMessages((prev) => [...prev, { role: "ai", text: `I couldn't apply that design — ${hint}` }]);
        } else {
          const mergedForApply = reuseDefaultArtboard
            ? reuseUntouchedDefaultArtboard(fullExistingForReplace, parsedForValidation!)
            : mergeIntoCanvas(fullExistingForReplace, parsedForValidation!);
          const spread = spreadArtboardsInState(mergedForApply, fullExistingForReplace);
          actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
          const diff = diffCraftStates(fullExistingForReplace as Record<string, any>, parsedForValidation! as Record<string, any>);
          const totalChanges = diff.added.length + diff.modified.length + diff.removed.length;
          void diff; void totalChanges;
          setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Design created! I've built the layout on your canvas.") + " ✓" + describeSubstitutions(repaired?.report) }]);
        }
      }
      setAiStatus("idle");
    } catch (e: any) {
      setAiStatus("error");
      setMessages((prev) => [...prev, { role: "ai", text: `Something went wrong: ${e.message?.slice(0, 120) ?? "Unknown error"}` }]);
      setTimeout(() => setAiStatus("idle"), 3000);
    }
  };


  if (isCollapsed) {
    return (
      <div className="h-full w-12 border-l border-border bg-card flex flex-col flex-shrink-0">
        <TooltipProvider delayDuration={100}>
          <div className="flex flex-col items-center pt-2 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsCollapsed(false)}>
                  <ChevronLeft size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Expand Panel</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-col items-center gap-1 mt-2 border-t border-border pt-2">
            {([
              { id: "kite-ai" as const, icon: Sparkles, label: "KiteAI", cls: "text-purple-500" },
              { id: "layers"  as const, icon: ListTree, label: "Layers",  cls: "" },
            ] as const).map(({ id, icon: Icon, label, cls }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === id ? "secondary" : "ghost"}
                    size="icon"
                    className={`h-8 w-8 ${cls}`}
                    onClick={() => { setActiveTab(id); setIsCollapsed(false); }}
                  >
                    <Icon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="h-full border-l border-border bg-card flex flex-col flex-shrink-0 relative"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={() => setIsResizing(true)}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize group z-10"
        title="Drag to resize"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DesignPanelTab)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-border flex items-center">
          <Button variant="ghost" size="icon" className="h-10 w-8 flex-shrink-0" onClick={() => setIsCollapsed(true)}>
            <ChevronRight size={16} />
          </Button>
          <ScrollArea className="flex-1">
            <TabsList className="inline-flex h-10 w-max min-w-full p-1 gap-1 bg-transparent">
              <TabsTrigger value="kite-ai" className="text-xs px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-purple-500">
                <Sparkles size={14} className="text-purple-500" />KiteAI
              </TabsTrigger>
              <TabsTrigger value="layers" className="text-xs px-3 gap-1.5 data-[state=active]:bg-background">
                <ListTree size={14} />Layers
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>

        {/* KiteAI tab */}
        <TabsContent value="kite-ai" className="flex-1 m-0 overflow-hidden flex flex-col min-h-0 data-[state=inactive]:hidden">
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex-shrink-0 mt-0.5 shadow-sm" />
                )}
                <div className={`max-w-[85%] px-3 py-2 text-sm leading-snug rounded-2xl ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  {m.imagePreview && (
                    i === messages.length - 1 && m.role === "user" && aiStatus === "loading" ? (
                      /* Processing shimmer — shown while the AI analyses the attached image */
                      <div className="block mb-1.5 rounded-lg overflow-hidden relative">
                        <img src={m.imagePreview} alt="Attached" className="max-h-28 max-w-full object-cover" />
                        {/* Shimmer sweep */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{ background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.18) 50%,transparent 100%)", animation: "de-imgsweep 2s ease-in-out infinite" }}
                        />
                        {/* Spinner overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: "rgba(76,29,149,0.32)" }}>
                          <div className="w-7 h-7 rounded-full border border-white/25 bg-white/15 flex items-center justify-center">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          </div>
                          <span className="text-[9px] text-white/75 font-medium">Analysing…</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLightboxSrc(m.imagePreview!)}
                        className="block mb-1.5 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/50 group relative"
                        title="Click to view full image"
                      >
                        <img src={m.imagePreview} alt="Attached" className="max-h-28 max-w-full object-cover" />
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </span>
                      </button>
                    )
                  )}
                  {m.text}
                  {m.designPreview && <DesignChatPreviewCard preview={m.designPreview} />}
                  {m.role === "user" && m.pinnedElement && (
                    <div className="flex items-center gap-1 mt-1.5 bg-white/15 rounded-md px-1.5 py-0.5">
                      <span className="text-[10px] leading-none">📌</span>
                      <span className="text-[10px] text-primary-foreground/80 font-medium truncate">
                        {m.pinnedElement.displayName}
                        {m.pinnedElement.label && m.pinnedElement.label !== m.pinnedElement.displayName
                          ? ` · "${m.pinnedElement.label.slice(0, 24)}"`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {aiStatus === "loading" && (
              <div className="flex gap-1.5 justify-start">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex-shrink-0 mt-0.5" />
                <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-sm flex items-center min-w-[120px]">
                  <span
                    className="text-[11px] text-muted-foreground italic transition-opacity duration-300"
                    style={{ opacity: thinkingVisible ? 1 : 0 }}
                  >
                    {THINKING_PHRASES[thinkingIdx]}
                  </span>
                </div>
              </div>
            )}
            {/* Status divider when processing an image */}
            {aiStatus === "loading" && messages.length > 0 && messages[messages.length - 1]?.role === "user" && messages[messages.length - 1]?.imagePreview && (
              <div className="flex items-center gap-2 px-0.5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                  <Loader2 className="w-2 h-2 animate-spin" />
                  Extracting layout from image
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div ref={messagesEndRef} />
            <style>{`
              @keyframes de-imgsweep {
                0%   { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
            `}</style>
          </div>
          <div className="px-2.5 py-2.5 border-t border-border shrink-0">
            {pinned && (
              <div className="flex items-center gap-1.5 mb-1.5 bg-primary/10 border border-primary/20 rounded-lg px-2 py-1">
                <MessageCirclePlus className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[10px] text-primary font-medium truncate flex-1 min-w-0">
                  {pinned.displayName}
                  {pinned.label && pinned.label !== pinned.displayName ? ` · "${pinned.label.slice(0, 24)}"` : ""}
                </span>
                <button
                  onClick={() => setPinned(null)}
                  className="text-primary/60 hover:text-primary transition-colors"
                  title="Remove pin"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {attachedImage && (
              <div className="flex items-center gap-2 mb-1.5 bg-muted/60 border border-border rounded-lg px-2 py-1.5">
                <img src={attachedImage.preview} alt="Attached" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground flex-1 min-w-0 truncate">
                  {prompt.trim().length > 10 ? "Reference ready · changes will be applied to canvas" : "Image ready · will be imported as new screen"}
                </span>
                <button onClick={() => setAttachedImage(null)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div
              className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-xl px-2.5 py-1.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleImageAttach(f); }}
            >
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                onPaste={(e) => {
                  const items = Array.from(e.clipboardData?.items || []);
                  const imageItem = items.find((item) => item.type.startsWith("image/"));
                  if (imageItem) { e.preventDefault(); const f = imageItem.getAsFile(); if (f) handleImageAttach(f); }
                }}
                placeholder={attachedImage ? "Optional: name this screen…" : "Ask KiteAI or drop a screenshot to import…"}
                disabled={aiStatus === "loading"}
                className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 min-w-0"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageAttach(f); e.target.value = ""; }}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={aiStatus === "loading"}
                className="w-5 h-5 rounded hover:bg-muted border border-transparent hover:border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40"
                title="Attach image to import as design"
              >
                <ImagePlus className="w-3 h-3" />
              </button>
              {aiStatus === "loading" && <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />}
              {aiStatus === "error"   && <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />}
              <button
                onClick={handleGenerate}
                disabled={(!prompt.trim() && !attachedImage) || aiStatus === "loading"}
                className="w-6 h-6 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground flex items-center justify-center transition-colors flex-shrink-0"
                title="Send"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
            </div>
          </div>
        </TabsContent>

        {/* Layers tab */}
        <TabsContent value="layers" className="flex-1 m-0 overflow-hidden flex flex-col min-h-0 data-[state=inactive]:hidden">
          <LayersView />
        </TabsContent>

      </Tabs>
      {/* Lightbox for chat image previews — rendered here so it is in the same
          scope as the lightboxSrc state declared in DesignPanel. fixed positioning
          means it overlays the full viewport regardless of DOM location. */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-1"
            onClick={() => setLightboxSrc(null)}
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxSrc}
            alt="Uploaded reference"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Canvas drop area ─────────────────────────────────────────────────────────

/**
 * If all artboards in `state` share the same x position (within `tol` px),
 * spread them left-to-right from x=64 with 80 px gaps — matching
 * spreadArtboardsInState's full-replace behaviour.
 * Returns the same object reference unchanged when no spreading is needed.
 */
function destackArtboards(state: Record<string, any>): Record<string, any> {
  const root = state["ROOT"];
  const rootNodes = Array.isArray(root?.nodes) ? root.nodes as string[] : [];
  const artboardEntries = rootNodes
    .filter((id, index) => rootNodes.indexOf(id) === index)
    .map((id) => [id, state[id]] as [string, any])
    .filter(([, node]) => node?.type?.resolvedName === "AstryxArtboard");
  if (artboardEntries.length < 2) return state;

  const xs = artboardEntries.map(([, n]: [string, any]) => Number(n.props?.x) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  // Only spread when artboards appear stacked (within 10 px of each other)
  if (maxX - minX > 10) return state;

  // Sort by existing x so relative order is preserved
  artboardEntries.sort(([, a]: [string, any], [, b]: [string, any]) =>
    (Number(a.props?.x) || 0) - (Number(b.props?.x) || 0)
  );
  const result = { ...state };
  let curX = 64;
  const baseY = Number(artboardEntries[0][1].props?.y) || 64;
  for (const [id, node] of artboardEntries) {
    const width = Number(node.props?.width) || 390;
    result[id] = { ...node, props: { ...node.props, x: curX, y: baseY } };
    curX += width + 80;
  }
  return result;
}

/**
 * Prepare a stored craft state for the canvas, or return null if it cannot be
 * rendered. Validating first matters because a malformed or truncated string
 * would produce a blank canvas with no error indicator rather than falling back
 * to the default artboard.
 *
 * Shared by the initial mount and by live updates, so a viewer receiving a
 * change sees it through exactly the same pipeline as the first load.
 */
function normalizeCraftStateForCanvas(craftState: string | null): string | null {
  if (!craftState) return null;
  try {
    const parsed = JSON.parse(craftState);
    const destacked = destackArtboards(parsed);
    // Only re-stringify if destacking actually changed something
    const json = destacked === parsed ? craftState : JSON.stringify(destacked);
    return sanitizeCraftState(json);
  } catch {
    return null;
  }
}

/**
 * Applies externally-changed craft state to an already-mounted editor.
 *
 * `<Frame data>` is only read when it mounts, so a read-only viewer watching a
 * shared Interface would keep showing whatever it first loaded. Deserializing
 * in place swaps the node tree without unmounting the canvas, which is what
 * preserves the viewer's scroll and pan/zoom across an update.
 *
 * Mounted only for read-only viewers on purpose: running this in an editable
 * session would let a stale prop overwrite the user's in-progress work.
 */
function CraftStateSync({ craftState }: { craftState: string | null }) {
  const { actions } = useEditor();
  // Seeded with the mount value: <Frame> has already rendered it, so applying
  // it again would be a redundant deserialize on first paint.
  const lastApplied = useRef<string | null>(craftState);

  useEffect(() => {
    if (craftState === lastApplied.current) return;
    lastApplied.current = craftState;
    const next = normalizeCraftStateForCanvas(craftState);
    if (!next) return;
    try {
      actions.deserialize(next);
    } catch (err) {
      console.error("[design] failed to apply live update:", err);
    }
  }, [craftState, actions]);

  return null;
}

function CanvasArea({ craftState }: { craftState: string | null }) {
  const validState = normalizeCraftStateForCanvas(craftState);

  if (validState) {
    return <Frame data={validState} />;
  }
  return (
    <Frame>
      <Element canvas is={AstryxSection} direction="row" gap={80} padding={40} align="start" justify="start">
        <Element canvas is={AstryxArtboard} label="Screen 1" direction="column" gap={16} padding={24}>
          {null}
        </Element>
      </Element>
    </Frame>
  );
}

// ─── DesignEditor ─────────────────────────────────────────────────────────────

export interface DesignEditorProps {
  editable: boolean;
  craftState: string | null;
  notes?: string | null;
  notesOpen?: boolean;
  onSetNotesOpen?: (open: boolean) => void;
  onSave?: (state: string) => void;
  /** Keepalive transport for the beforeunload flush — see SaveWatcher. */
  onBeforeUnloadSave?: (state: string) => void;
  onNotesChange?: (notes: string) => void;
  /** Identity for the right-rail KiteAI conversation, so it can be persisted. */
  designId?: string;
  /** Owner check for claiming the generation exchange that produced this design. */
  currentUserId?: string | null;
}

export function DesignEditor({ editable, craftState, notes, notesOpen: notesOpenProp, onSetNotesOpen, onSave, onBeforeUnloadSave, onNotesChange, designId, currentUserId }: DesignEditorProps) {
  const [zoom, setZoom] = useState(1);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [notesOpenInternal, setNotesOpenInternal] = useState(false);
  const [pinned, setPinned] = useState<PinnedElement | null>(null);

  const notesOpen = notesOpenProp !== undefined ? notesOpenProp : notesOpenInternal;
  const setNotesOpen = onSetNotesOpen ?? setNotesOpenInternal;

  const zoomIn = useCallback(() => setZoom((z) => Math.min(2, z * 1.15)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.15, z / 1.15)), []);
  const fitView = useCallback(() => setFitTrigger((t) => t + 1), []);

  const stableSave = useCallback(
    (state: string) => { onSave?.(state); },
    [onSave],
  );
  const stableBeforeUnloadSave = useCallback(
    (state: string) => { onBeforeUnloadSave?.(state); },
    [onBeforeUnloadSave],
  );

  return (
    <PinnedElementContext.Provider value={{ pinned, setPinned }}>
    <NotesContext.Provider value={{ notesOpen, setNotesOpen }}>
      <Editor
        resolver={resolver}
        enabled={editable}
        // Rebind craft's native multi-select gesture from the default
        // Cmd/Ctrl+click to Shift+click (design-tool convention). This is the
        // single source of truth for multi-selection — state.events.selected
        // holds every selected id.
        handlers={(store) =>
          new DefaultEventHandlers({
            store,
            removeHoverOnMouseleave: false,
            isMultiSelectEnabled: (e: MouseEvent) => e.shiftKey,
          })
        }
      >
        <SnapGuideContext.Provider value={_setSnapGuides}>
        <HistoryProvider>
        <div className="flex h-full w-full" style={{ overflow: "clip" }}>
          {editable && <LeftRail />}
          <div className="flex flex-col flex-1 min-w-0">
            {editable && <CanvasToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onFitView={fitView} />}
            {/* data-canvas-area marks this region for the right-click context menu */}
            <div className="relative flex-1 min-h-0" data-canvas-area="true">
              <InfiniteCanvas zoom={zoom} onZoom={setZoom} fitTrigger={fitTrigger}>
                <CanvasArea craftState={craftState} />
                {!editable && <CraftStateSync craftState={craftState} />}
              </InfiniteCanvas>
              {/* View-only notes overlay (editable users have Notes tab in DesignPanel) */}
              {!editable && (
                <NotesPanel
                  notes={notes ?? ""}
                  editable={false}
                  onNotesChange={undefined}
                />
              )}
            </div>
          </div>
          {editable && (
            <DesignPanel
              notes={notes ?? ""}
              editable={editable}
              onNotesChange={onNotesChange}
              designId={designId}
              currentUserId={currentUserId}
            />
          )}
        </div>
        {editable && onSave && (
          <SaveWatcher
            onSave={stableSave}
            onBeforeUnloadSave={onBeforeUnloadSave ? stableBeforeUnloadSave : undefined}
          />
        )}
        {editable && <KeyboardHandler />}
        {editable && <MultiSelectHandler />}
        {editable && <CanvasContextMenu />}
        {editable && <SelectionPinButton />}
        </HistoryProvider>
        </SnapGuideContext.Provider>
      </Editor>
    </NotesContext.Provider>
    </PinnedElementContext.Provider>
  );
}

export { createEmptyCraftState, deleteNodesFromState, extractNodeSubtree, copyNodesToClipboard, pasteFromClipboard };
