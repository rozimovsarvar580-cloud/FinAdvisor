import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("displays the localized title, description, and optional next action", () => {
    render(
      <EmptyState
        action={<a href="/plans/new">Create a plan</a>}
        description="Your saved plans will appear here."
        title="No plans yet"
      />
    );

    expect(screen.getByRole("heading", { name: "No plans yet" })).toBeTruthy();
    expect(screen.getByText("Your saved plans will appear here.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create a plan" })).toBeTruthy();
  });
});
