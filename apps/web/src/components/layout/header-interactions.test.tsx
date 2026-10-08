import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  resolvedTheme: "light" as string | undefined,
  setTheme: vi.fn()
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => (key: string) => `${namespace}:${key}`
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: mocks.resolvedTheme,
    setTheme: mocks.setTheme
  })
}));

vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");

  return {
    Link: ({
      href,
      onClick,
      ...props
    }: {
      href: string;
      onClick?: React.MouseEventHandler<HTMLAnchorElement>;
      [key: string]: unknown;
    }) =>
      React.createElement("a", {
        href,
        ...props,
        onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
          onClick?.(event);
          event.preventDefault();
        }
      } as React.AnchorHTMLAttributes<HTMLAnchorElement>),
    usePathname: () => "/pricing",
    useRouter: () => ({ replace: mocks.replace })
  };
});

import { Header } from "@/components/layout/header";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

describe("header interactions", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.setTheme.mockReset();
    mocks.resolvedTheme = "light";
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 768
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove("theme-transition");
  });

  it("gives navigation links an animated hover and keyboard-focus underline", () => {
    render(<Header />);

    const menuToggle = screen.getByRole("button", { name: "nav:openMenu" });
    const primaryNavigation = screen.getByRole("navigation", {
      name: "nav:primaryNavigation"
    });
    const pricingLink = screen.getByRole("link", { name: "nav:pricing" });
    const businessLink = screen.getByRole("link", { name: "nav:business" });
    expect(primaryNavigation.contains(pricingLink)).toBe(true);
    expect(businessLink.getAttribute("href")).toBe("/business");
    expect(pricingLink.className).toContain("after:scale-x-0");
    expect(pricingLink.className).toContain("hover:after:scale-x-100");
    expect(pricingLink.className).toContain("focus-visible:after:scale-x-100");
    expect(pricingLink.className).toContain("focus-visible:ring-2");

    fireEvent.click(menuToggle);
    expect(menuToggle.getAttribute("aria-expanded")).toBe("true");
    expect(menuToggle.getAttribute("aria-controls")).toBe("mobile-navigation");
    const mobileNavigation = screen.getByRole("navigation", {
      name: "nav:mobileNavigation"
    });
    expect(
      within(mobileNavigation).getByRole("link", { name: "nav:features" }).className
    ).toContain("focus-visible:after:scale-x-100");
    expect(mobileNavigation).toBeTruthy();

    fireEvent.click(
      within(mobileNavigation).getByRole("link", { name: "nav:pricing" })
    );
    expect(screen.queryByRole("navigation", { name: "nav:mobileNavigation" })).toBeNull();
    expect(menuToggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the mobile menu with Escape and returns focus to its toggle", () => {
    render(<Header />);

    const menuToggle = screen.getByRole("button", { name: "nav:openMenu" });
    fireEvent.click(menuToggle);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("navigation", { name: "nav:mobileNavigation" })).toBeNull();
    expect(menuToggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menuToggle);
  });

  it("updates the sticky header and scroll progress as the page scrolls", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 200 });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 1000
    });

    render(<Header />);

    const header = document.querySelector("header");
    const progress = screen.getByTestId("scroll-progress").firstElementChild;
    expect(header?.className).not.toContain("backdrop-blur-xl");
    expect((progress as HTMLElement).style.width).toBe("0%");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
    fireEvent.scroll(window);
    expect(header?.className).toContain("backdrop-blur-xl");
    expect((progress as HTMLElement).style.width).toBe("50%");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 900 });
    fireEvent.scroll(window);
    expect((progress as HTMLElement).style.width).toBe("100%");
  });

  it("uses translated labels and routes locale changes through navigation", () => {
    render(<LocaleSwitcher />);

    const select = screen.getByRole("combobox", {
      name: "common:language"
    }) as HTMLSelectElement;
    expect(select.className).toContain("hover:border-primary/60");
    expect(select.className).toContain("focus-visible:ring-2");

    fireEvent.change(select, { target: { value: "ru" } });
    expect(mocks.replace).toHaveBeenCalledWith("/pricing", { locale: "ru" });
  });

  it("toggles the theme from an accessible, focusable button", () => {
    vi.useFakeTimers();
    const { rerender } = render(<ThemeToggle />);

    const toggle = screen.getByRole("button", {
      name: "common:theme"
    }) as HTMLButtonElement;
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.className).toContain("hover:bg-primary/10");
    expect(toggle.className).toContain("focus-visible:ring-2");
    expect(toggle.disabled).toBe(false);

    fireEvent.click(toggle);
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
    expect(document.documentElement.classList.contains("theme-transition")).toBe(true);

    vi.advanceTimersByTime(300);
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);

    mocks.resolvedTheme = "dark";
    rerender(<ThemeToggle />);
    fireEvent.click(toggle);
    expect(mocks.setTheme).toHaveBeenLastCalledWith("light");
    expect(document.documentElement.classList.contains("theme-transition")).toBe(true);
    vi.advanceTimersByTime(300);
  });
});
