import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "use-intl";
import { describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";

import { PasswordField } from "./password-field";

function renderPasswordField(disabled = false) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as unknown as AbstractIntlMessages}
    >
      <label htmlFor="password">Password</label>
      <PasswordField disabled={disabled} id="password" />
    </NextIntlClientProvider>
  );
}

describe("PasswordField", () => {
  it("toggles the input type with an inline, accessible icon button", () => {
    renderPasswordField();
    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(input.getAttribute("type")).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.textContent).toBe("");
    expect(toggle.querySelector("svg")).not.toBeNull();

    fireEvent.click(toggle);

    expect(input.getAttribute("type")).toBe("text");
    expect(
      screen
        .getByRole("button", { name: "Hide password" })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("keeps the input focused when toggling and makes the control keyboard focusable", () => {
    renderPasswordField();
    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    input.focus();
    fireEvent.mouseDown(toggle);
    fireEvent.click(toggle);

    expect(document.activeElement).toBe(input);
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    expect(document.activeElement).toBe(input);
  });

  it("disables the visibility control when the input is disabled", () => {
    renderPasswordField(true);

    expect(screen.getByLabelText("Password")).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Show password" })
    ).toHaveProperty("disabled", true);
  });
});
