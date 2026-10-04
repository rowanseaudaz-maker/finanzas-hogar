import { describe, expect, it } from "vitest";
import { parseFinanceBackup, serializeFinanceBackup } from "./backup.js";
import { createInitialFinanceData } from "./storage.js";

function createBackupData() {
  const data = createInitialFinanceData();
  data.settings.currencyCode = "EUR";
  data.categories.push({ id: "income-salary", kind: "income", name: "Salario" });
  data.transactions.push({
    id: "transaction-1",
    kind: "income",
    date: "2026-10-03",
    description: "Sueldo",
    amountMinor: 225000,
    categoryId: "income-salary",
  });
  data.balances = { savingsMinor: 50000, debtMinor: 12000 };
  return data;
}

describe("serializeFinanceBackup", () => {
  it("exports the complete dataset with its schema version", () => {
    const data = createBackupData();
    const serializedData = serializeFinanceBackup(data);

    expect(JSON.parse(serializedData)).toEqual(data);
    expect(JSON.parse(serializedData).schemaVersion).toBe(1);
  });

  it("refuses to export invalid data", () => {
    expect(() => serializeFinanceBackup({ schemaVersion: 1 })).toThrow(TypeError);
  });
});

describe("parseFinanceBackup", () => {
  it("restores a valid exported dataset", () => {
    const data = createBackupData();

    expect(parseFinanceBackup(serializeFinanceBackup(data))).toEqual({ valid: true, data });
  });

  it("rejects malformed JSON without returning data", () => {
    expect(parseFinanceBackup("{")).toEqual({ valid: false, error: "invalid-json" });
  });

  it("rejects unsupported schema versions distinctly", () => {
    const incompatibleData = { ...createBackupData(), schemaVersion: 2 };

    expect(parseFinanceBackup(JSON.stringify(incompatibleData))).toEqual({
      valid: false,
      error: "unsupported-version",
    });
  });

  it("rejects invalid structure and invalid transaction-category references", () => {
    const invalidData = createBackupData();
    invalidData.transactions[0].categoryId = "missing-category";

    expect(parseFinanceBackup(JSON.stringify(invalidData))).toEqual({
      valid: false,
      error: "invalid-data",
    });
    expect(parseFinanceBackup(JSON.stringify([]))).toEqual({ valid: false, error: "invalid-data" });
  });
});