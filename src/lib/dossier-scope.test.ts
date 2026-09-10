import { describe, expect, it } from "vitest";
import { dossierScopeAllows, parseDossierScope } from "./dossier-scope";

describe("parseDossierScope", () => {
  it("uses null to represent all dossiers", () => {
    expect(parseDossierScope(null)).toEqual({ valid: true, value: null });
  });

  it("accepts a non-empty allowlist and removes duplicates", () => {
    expect(parseDossierScope(["dossier-a", "dossier-a", "dossier-b"])).toEqual({
      valid: true,
      value: ["dossier-a", "dossier-b"],
    });
  });

  it("rejects empty or malformed allowlists", () => {
    expect(parseDossierScope([]).valid).toBe(false);
    expect(parseDossierScope(["dossier-a", ""]).valid).toBe(false);
    expect(parseDossierScope("dossier-a").valid).toBe(false);
  });
});

describe("dossierScopeAllows", () => {
  it("allows every dossier for an unrestricted scope", () => {
    expect(dossierScopeAllows(null, "dossier-a")).toBe(true);
  });

  it("allows only dossiers present in an explicit allowlist", () => {
    expect(dossierScopeAllows(["dossier-a"], "dossier-a")).toBe(true);
    expect(dossierScopeAllows(["dossier-a"], "dossier-b")).toBe(false);
  });
});
