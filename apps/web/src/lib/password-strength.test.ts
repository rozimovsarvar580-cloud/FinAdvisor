import { describe, expect, it } from "vitest";

import { getPasswordStrength } from "./password-strength";

describe("getPasswordStrength", () => {
  it("returns zero for an empty password", () => {
    expect(getPasswordStrength("")).toBe(0);
  });

  it("scores short and simple passwords as weak", () => {
    expect(getPasswordStrength("abc")).toBe(0);
    expect(getPasswordStrength("abcdefgh")).toBe(1);
  });

  it("scores a mixed password by its complexity checks", () => {
    expect(getPasswordStrength("Abcdef12")).toBe(3);
  });

  it("scores a long mixed password as strong", () => {
    expect(getPasswordStrength("Abcdef12!")).toBe(4);
  });
});
