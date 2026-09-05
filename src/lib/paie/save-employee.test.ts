import { describe, expect, it, vi } from "vitest";
import { saveEmployeeWithSchemaCompatibility } from "./save-employee";
const missing = (column: string) => ({ error: { code: "PGRST204", message: `Could not find the '${column}' column of 'employees' in the schema cache` } });

describe("employee schema compatibility", () => {
  it("keeps canonical payroll values while omitting missing duplicates and unused fields", async () => {
    const save = vi.fn().mockResolvedValueOnce(missing("cnss_number")).mockResolvedValueOnce(missing("notes")).mockResolvedValue({ error: null });
    const payload = { numero_cnss: "123", cnss_number: "123", notes: null, salaire_brut: 7000 };
    expect(await saveEmployeeWithSchemaCompatibility(payload, save)).toEqual({ error: null });
    expect(save.mock.calls[2][0]).toEqual({ numero_cnss: "123", salaire_brut: 7000 });
    expect(payload.cnss_number).toBe("123");
  });
  it("never discards entered optional data", async () => {
    const save = vi.fn().mockResolvedValue(missing("notes"));
    const result = await saveEmployeeWithSchemaCompatibility({ notes: "À conserver" }, save);
    expect(result.error?.code).toBe("PAYROLL_SCHEMA_REQUIRED");
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("does not retry permission or validation errors", async () => {
    const error = { code: "42501", message: "permission denied" };
    const save = vi.fn().mockResolvedValue({ error });
    expect(await saveEmployeeWithSchemaCompatibility({}, save)).toEqual({ error });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
