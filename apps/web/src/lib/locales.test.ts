import { describe, expect, it } from "vitest";

import { isSupportedLocale } from "./locales";

describe("isSupportedLocale", () => {
  it.each(["uz", "ru", "en"])("accepts %s", (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
  });

  it("rejects unsupported locales", () => {
    expect(isSupportedLocale("fr")).toBe(false);
  });
});
