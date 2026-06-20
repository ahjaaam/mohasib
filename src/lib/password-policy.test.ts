import { describe, expect, it } from "vitest";
import { validatePassword } from "./password-policy";

describe("validatePassword", () => {
  it("accepts a strong password", () => {
    expect(validatePassword("Mohasib!2026Secure")).toBeNull();
  });

  it.each([
    ["Short1!", "au moins 12"],
    ["MOHASIB!2026SECURE", "minuscule"],
    ["mohasib!2026secure", "majuscule"],
    ["Mohasib!SecurePass", "chiffre"],
    ["Mohasib2026Secure", "symbole"],
  ])("rejects invalid password %s", (password, expected) => {
    expect(validatePassword(password)).toContain(expected);
  });
});
