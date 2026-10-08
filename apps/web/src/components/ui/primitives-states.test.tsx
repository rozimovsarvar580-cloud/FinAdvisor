import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

describe("interactive primitive states", () => {
  it("provides token-based hover and keyboard focus styles for cards", () => {
    render(
      <Card tabIndex={0}>
        Card content
      </Card>
    );

    const card = screen.getByText("Card content");
    expect(card.className).toContain("hover:border-primary/50");
    expect(card.className).toContain("focus-visible:ring-2");
    expect(card.className).toContain("focus-visible:ring-ring");
    expect(card.className).toContain("motion-safe:hover:-translate-y-0.5");
    expect(card.className).toContain("motion-reduce:transition-none");
  });

  it("styles input hover and focus and preserves native disabled behavior", () => {
    render(<Input aria-label="Email" disabled />);

    const input = screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.className).toContain("hover:border-primary/60");
    expect(input.className).toContain("focus-visible:ring-2");
    expect(input.className).toContain("disabled:cursor-not-allowed");
    expect(input.className).toContain("disabled:bg-muted/60");
  });

  it("styles select hover and focus and preserves native disabled behavior", () => {
    render(
      <Select aria-label="Language" disabled defaultValue="en">
        <option value="en">English</option>
      </Select>
    );

    const select = screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.className).toContain("hover:border-primary/60");
    expect(select.className).toContain("focus-visible:ring-2");
    expect(select.className).toContain("disabled:cursor-not-allowed");
    expect(select.className).toContain("disabled:bg-muted/60");
  });

  it("supports interactive, focusable and disabled tab triggers", () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger disabled value="locked">
            Locked
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
        <TabsContent value="locked">Locked content</TabsContent>
      </Tabs>
    );

    const overview = screen.getByRole("tab", { name: "Overview" });
    const locked = screen.getByRole("tab", { name: "Locked" }) as HTMLButtonElement;
    expect(overview.className).toContain("hover:bg-background/60");
    expect(overview.className).toContain("focus-visible:ring-2");
    expect(locked.disabled).toBe(true);
    expect(locked.className).toContain("disabled:pointer-events-none");

    fireEvent.click(overview);
    expect(overview.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Overview content")).toBeTruthy();
  });
});
