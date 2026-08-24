import { COMPONENT_REGISTRY, type ComponentDef } from "./builderRegistry";

export interface RecommendationChild {
  displayName: string;
  props?: Record<string, unknown>;
}

export interface ContainerRecommendationContext {
  displayName: string;
  direction?: string;
  children: RecommendationChild[];
}

export interface ContainerRecommendation {
  componentId: string;
  reason: string;
  label?: string;
  pattern?: RecommendationPatternNode;
}

export interface RecommendationPatternNode {
  componentId: string;
  children?: RecommendationPatternNode[];
}

export interface SelectionAssistantVisibility {
  showAskAI: boolean;
  showRecommendations: boolean;
}

const RECOMMENDABLE_CONTAINERS = new Set([
  "AstryxArtboard",
  "AstryxSection",
  "AstryxStack",
  "AstryxHStack",
  "AstryxCard",
  "AstryxClickableCard",
  "AstryxSelectableCard",
  "AstryxGrid",
  "AstryxFormLayout",
  "AstryxInputGroup",
  "AstryxList",
  "AstryxField",
]);

const FORM_CONTAINERS = new Set([
  "AstryxFormLayout",
  "AstryxField",
  "AstryxInputGroup",
]);

const CARD_CONTAINERS = new Set([
  "AstryxCard",
  "AstryxClickableCard",
  "AstryxSelectableCard",
]);

const INPUT_COMPONENTS = new Set([
  "AstryxTextInput",
  "AstryxTextArea",
  "AstryxNumberInput",
  "AstryxSelect",
  "AstryxCheckbox",
  "AstryxRadioGroup",
  "AstryxSwitch",
  "AstryxDateInput",
  "AstryxTimeInput",
  "AstryxDateTimeInput",
  "AstryxDateRangeInput",
  "AstryxFileInput",
  "AstryxTypeahead",
  "AstryxMultiSelector",
  "AstryxComplexSelector",
  "AstryxPowerSearch",
  "AstryxTokenizer",
]);

const REGISTRY_IDS = new Set(COMPONENT_REGISTRY.map((component) => component.id));

function componentName(id: string): string {
  return `Astryx${id}`;
}

function hasChild(children: RecommendationChild[], id: string): boolean {
  return children.some((child) => child.displayName === componentName(id));
}

function pattern(
  componentId: string,
  label: string,
  reason: string,
  children: RecommendationPatternNode[],
): ContainerRecommendation {
  return { componentId, label, reason, pattern: { componentId, children } };
}

const CONTENT_CARD_PATTERN = (reason = "Add a complete content card") =>
  pattern("Card", "Content card", reason, [
    { componentId: "Heading" },
    { componentId: "Text" },
    { componentId: "Button" },
  ]);

const CONTENT_SECTION_PATTERN = (reason = "Add a complete content section") =>
  pattern("Section", "Content section", reason, [
    { componentId: "Heading" },
    { componentId: "Text" },
    { componentId: "Button" },
  ]);

const FORM_PATTERN = () =>
  pattern("FormLayout", "Form starter", "Add a small form with two fields", [
    { componentId: "Field" },
    { componentId: "Field" },
    { componentId: "Button" },
  ]);

function patternUsesKnownComponents(node: RecommendationPatternNode): boolean {
  return REGISTRY_IDS.has(node.componentId)
    && (node.children ?? []).every(patternUsesKnownComponents);
}

function firstAvailable(
  children: RecommendationChild[],
  candidates: ContainerRecommendation[],
): ContainerRecommendation[] {
  const selected: ContainerRecommendation[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (
      selected.length >= 3 ||
      seen.has(candidate.componentId) ||
      hasChild(children, candidate.componentId) ||
      (candidate.pattern
        ? !patternUsesKnownComponents(candidate.pattern)
        : !REGISTRY_IDS.has(candidate.componentId))
    ) {
      continue;
    }
    seen.add(candidate.componentId);
    selected.push(candidate);
  }

  return selected;
}

/**
 * Returns the three most useful direct-child additions for a selected container.
 * This deliberately uses only local craft state so component selection stays
 * instant and never spends model tokens.
 */
export function getContainerRecommendations(
  context: ContainerRecommendationContext,
): ContainerRecommendation[] {
  if (!RECOMMENDABLE_CONTAINERS.has(context.displayName)) return [];

  const { displayName, children } = context;
  const hasHeading = hasChild(children, "Heading");
  const hasText = hasChild(children, "Text");
  const hasAction = hasChild(children, "Button") || hasChild(children, "IconButton");
  const hasInput = children.some((child) => INPUT_COMPONENTS.has(child.displayName));
  const direction = displayName === "AstryxHStack" ? "row" : context.direction ?? "column";

  if (displayName === "AstryxList") {
    return firstAvailable(children, [
      { componentId: "ListItem", reason: "Add another list item" },
      { componentId: "EmptyState", reason: "Show a useful empty state" },
      { componentId: "Button", reason: "Add a list action" },
      { componentId: "Text", reason: "Add supporting context" },
    ]);
  }

  if (FORM_CONTAINERS.has(displayName)) {
    return firstAvailable(children, [
      ...(hasInput ? [{ componentId: "Button", reason: "Add the next form action" }] : []),
      { componentId: "TextInput", reason: "Add a form field" },
      { componentId: "Select", reason: "Let people choose an option" },
      { componentId: "TextArea", reason: "Capture longer responses" },
      { componentId: "Button", reason: "Add a form action" },
    ]);
  }

  if (displayName === "AstryxGrid") {
    return firstAvailable(children, [
      CONTENT_CARD_PATTERN("Add a complete grid item"),
      { componentId: "EmptyState", reason: "Handle an empty collection" },
      { componentId: "Button", reason: "Add a collection action" },
      { componentId: "Heading", reason: "Label the collection" },
    ]);
  }

  if (CARD_CONTAINERS.has(displayName)) {
    return firstAvailable(children, [
      ...(!hasHeading ? [{ componentId: "Heading", reason: "Give this card a clear title" }] : []),
      ...(!hasText ? [{ componentId: "Text", reason: "Add supporting copy" }] : []),
      ...(!hasAction ? [{ componentId: "Button", reason: "Add a clear action" }] : []),
      { componentId: "Badge", reason: "Add a compact status label" },
      { componentId: "Divider", reason: "Separate card content" },
      { componentId: "EmptyState", reason: "Explain an empty card" },
    ]);
  }

  if (displayName === "AstryxArtboard") {
    return firstAvailable(children, [
      CONTENT_SECTION_PATTERN(),
      CONTENT_CARD_PATTERN(),
      FORM_PATTERN(),
      { componentId: "Grid", reason: "Add a structured collection layout" },
      { componentId: "List", reason: "Add a structured list layout" },
    ]);
  }

  if (displayName === "AstryxSection" || displayName === "AstryxStack" || displayName === "AstryxHStack") {
    return firstAvailable(children, [
      CONTENT_CARD_PATTERN(),
      CONTENT_SECTION_PATTERN("Add a nested content section"),
      ...(direction === "row"
        ? [{ componentId: "Grid", reason: "Add a structured collection layout" }]
        : [FORM_PATTERN()]),
      { componentId: "Heading", reason: "Add a section heading" },
    ]);
  }

  return firstAvailable(children, [
    ...(!hasHeading ? [{ componentId: "Heading", reason: "Start with a clear heading" }] : []),
    ...(!hasText ? [{ componentId: "Text", reason: "Add supporting copy" }] : []),
    ...(!hasAction ? [{ componentId: "Button", reason: "Add a primary action" }] : []),
    ...(direction === "row"
      ? [{ componentId: "Badge", reason: "Add concise status information" }]
      : [{ componentId: "Divider", reason: "Separate content groups" }]),
    { componentId: "EmptyState", reason: "Explain an empty area" },
    { componentId: "Card", reason: "Group related content" },
  ]);
}

export function isRecommendableContainer(displayName: string | undefined): boolean {
  return !!displayName && RECOMMENDABLE_CONTAINERS.has(displayName);
}

/**
 * The floating assistant remains useful for any single selected design node,
 * including artboards. Recommendations are deliberately narrower: only known
 * containers should expose an action that inserts direct children.
 */
export function getSelectionAssistantVisibility(
  displayName: string | undefined,
  isSingleSelection: boolean,
  isRoot: boolean,
): SelectionAssistantVisibility {
  const showAskAI = !!displayName && isSingleSelection && !isRoot;
  return {
    showAskAI,
    showRecommendations: showAskAI && isRecommendableContainer(displayName),
  };
}

export function getRecommendationComponent(
  recommendation: ContainerRecommendation,
): ComponentDef | undefined {
  return COMPONENT_REGISTRY.find((component) => component.id === recommendation.componentId);
}