import { describe, expect, it } from "vitest";
import {
  getContainerRecommendations,
  getSelectionAssistantVisibility,
  isRecommendableContainer,
} from "../containerRecommendations";

describe("container recommendations", () => {
  it("offers an immediate content hierarchy for an empty card", () => {
    expect(getContainerRecommendations({
      displayName: "AstryxCard",
      children: [],
    })).toEqual([
      { componentId: "Heading", reason: "Give this card a clear title" },
      { componentId: "Text", reason: "Add supporting copy" },
      { componentId: "Button", reason: "Add a clear action" },
    ]);
  });

  it("does not repeat direct-child roles that are already present", () => {
    const choices = getContainerRecommendations({
      displayName: "AstryxCard",
      children: [
        { displayName: "AstryxHeading" },
        { displayName: "AstryxText" },
        { displayName: "AstryxButton" },
      ],
    });

    expect(choices.map((choice) => choice.componentId)).toEqual([
      "Badge",
      "Divider",
      "EmptyState",
    ]);
  });

  it("advances the sparkle choice after the first addition", () => {
    const choices = getContainerRecommendations({
      displayName: "AstryxCard",
      children: [{ displayName: "AstryxHeading" }],
    });

    expect(choices.map((choice) => choice.componentId)).toEqual([
      "Text",
      "Button",
      "Badge",
    ]);
  });

  it("prioritizes an action after a form already contains input", () => {
    const choices = getContainerRecommendations({
      displayName: "AstryxFormLayout",
      children: [{ displayName: "AstryxTextInput" }],
    });

    expect(choices[0]).toEqual({
      componentId: "Button",
      reason: "Add the next form action",
    });
    expect(choices.map((choice) => choice.componentId)).not.toContain("TextInput");
  });

  it("uses list-specific choices for list containers", () => {
    expect(getContainerRecommendations({
      displayName: "AstryxList",
      children: [],
    }).map((choice) => choice.componentId)).toEqual([
      "ListItem",
      "EmptyState",
      "Button",
    ]);
  });

  it("only enables the floating helper for supported containers", () => {
    expect(isRecommendableContainer("AstryxArtboard")).toBe(true);
    expect(isRecommendableContainer("AstryxSection")).toBe(true);
    expect(isRecommendableContainer("AstryxCard")).toBe(true);
    expect(isRecommendableContainer("AstryxButton")).toBe(false);
    expect(isRecommendableContainer(undefined)).toBe(false);
  });

  it("shows both controls for artboards and supported containers, but not leaves", () => {
    expect(getSelectionAssistantVisibility("AstryxArtboard", true, false)).toEqual({
      showAskAI: true,
      showRecommendations: true,
    });
    expect(getSelectionAssistantVisibility("AstryxCard", true, false)).toEqual({
      showAskAI: true,
      showRecommendations: true,
    });
    expect(getSelectionAssistantVisibility("AstryxButton", true, false)).toEqual({
      showAskAI: true,
      showRecommendations: false,
    });
  });

  it("offers a useful content hierarchy for an empty artboard", () => {
    const choices = getContainerRecommendations({
      displayName: "AstryxArtboard",
      children: [],
    });

    expect(choices.map((choice) => choice.label)).toEqual([
      "Content section",
      "Content card",
      "Form starter",
    ]);
    expect(choices[0].pattern).toEqual({
      componentId: "Section",
      children: [
        { componentId: "Heading" },
        { componentId: "Text" },
        { componentId: "Button" },
      ],
    });
    expect(choices[1].pattern?.children).toHaveLength(3);
    expect(choices[2].pattern?.children?.map((child) => child.componentId)).toEqual([
      "Field",
      "Field",
      "Button",
    ]);
  });

  it("offers nested patterns for layout containers without repeating roots", () => {
    const choices = getContainerRecommendations({
      displayName: "AstryxSection",
      children: [{ displayName: "AstryxCard" }],
    });

    expect(choices.map((choice) => choice.label ?? choice.componentId)).toEqual([
      "Content section",
      "Form starter",
      "Heading",
    ]);
    expect(choices[0].pattern?.componentId).toBe("Section");
  });

  it("does not expose controls for root or multi-selection", () => {
    expect(getSelectionAssistantVisibility("ROOT", true, true)).toEqual({
      showAskAI: false,
      showRecommendations: false,
    });
    expect(getSelectionAssistantVisibility("AstryxCard", false, false)).toEqual({
      showAskAI: false,
      showRecommendations: false,
    });
  });
});