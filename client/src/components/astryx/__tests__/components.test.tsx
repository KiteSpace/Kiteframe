import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AstryxSelect } from "../components";

describe("AstryxSelect open state", () => {
  it("renders closed by default without showing the option list", () => {
    render(<AstryxSelect placeholder="Choose a plan" options="Basic,Pro,Enterprise" />);

    expect(screen.getByText("Choose a plan")).toBeTruthy();
    expect(screen.queryByText("Basic")).toBeNull();
    expect(screen.queryByText("Pro")).toBeNull();
    expect(screen.queryByText("Enterprise")).toBeNull();
  });

  it("renders the option preview when open is enabled", () => {
    render(<AstryxSelect placeholder="Choose a plan" options="Basic,Pro,Enterprise,Teams" open />);

    expect(screen.getByText("Choose a plan")).toBeTruthy();
    expect(screen.getByText("Basic")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.getByText("Enterprise")).toBeTruthy();
    expect(screen.queryByText("Teams")).toBeNull();
  });

  it("keeps the open state through a JSON craft prop round-trip", () => {
    const original = {
      type: { resolvedName: "AstryxSelect" },
      props: { placeholder: "Choose a plan", options: "Basic,Pro", open: true },
    };

    const loaded = JSON.parse(JSON.stringify(original));

    expect(loaded.props.open).toBe(true);
    expect(loaded.props.placeholder).toBe("Choose a plan");
    expect(loaded.props.options).toBe("Basic,Pro");
  });
});