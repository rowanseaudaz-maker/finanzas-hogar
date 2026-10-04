import { describe, expect, it } from "vitest";
import {
  parseFinanceBackup,
  parseHouseholdBackupV2,
  serializeFinanceBackup,
  serializeHouseholdBackupV2,
} from "./backup.js";
import { createInitialFinanceData, createInitialHouseholdDataV2 } from "./storage.js";

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

function createHouseholdBackupDataV2() {
  const data = createInitialHouseholdDataV2("EUR");
  data.incomeEntries.push({
    id: "income-1",
    memberId: "lisandro",
    date: "2026-10-01",
    description: "Sueldo",
    amountMinor: 225000,
    categoryId: "income-other",
  });
  data.paymentPlans.push({
    id: "plan-1",
    description: "Compra compartida",
    categoryId: "payment-other",
    responsibility: "shared",
    buyerMemberId: "catriel",
    cardName: "Nación Visa",
    payer: { kind: "external", name: "Padres" },
    installments: [
      {
        id: "installment-2",
        number: 2,
        total: 3,
        dueDate: "2026-10-31",
        amountMinor: 12345,
        status: "pending",
      },
    ],
  });
  data.balances.lisandro.savingsMinor = 50000;
  data.balances.catriel.debtMinor = 12000;
  return data;
}

describe("serializeHouseholdBackupV2", () => {
  it("exports the complete v2 dataset with schema version 2", () => {
    const data = createHouseholdBackupDataV2();
    const serializedData = serializeHouseholdBackupV2(data);

    expect(JSON.parse(serializedData)).toEqual(data);
    expect(JSON.parse(serializedData).schemaVersion).toBe(2);
  });

  it("refuses to export invalid v2 data", () => {
    expect(() => serializeHouseholdBackupV2({ schemaVersion: 2 })).toThrow(TypeError);
  });
});

describe("parseHouseholdBackupV2", () => {
  it("restores a valid v2 backup without losing entries, plans, or balances", () => {
    const data = createHouseholdBackupDataV2();

    expect(parseHouseholdBackupV2(serializeHouseholdBackupV2(data))).toEqual({ valid: true, data });
  });

  it("rejects malformed JSON and non-object JSON", () => {
    expect(parseHouseholdBackupV2("{")).toEqual({ valid: false, error: "invalid-json" });
    expect(parseHouseholdBackupV2(JSON.stringify([]))).toEqual({ valid: false, error: "invalid-data" });
  });

  it("rejects v1 and future schemas distinctly", () => {
    expect(parseHouseholdBackupV2(JSON.stringify(createBackupData()))).toEqual({
      valid: false,
      error: "unsupported-version",
    });
    expect(
      parseHouseholdBackupV2(JSON.stringify({ ...createHouseholdBackupDataV2(), schemaVersion: 3 })),
    ).toEqual({ valid: false, error: "unsupported-version" });
  });

  it("rejects invalid category references and payment data", () => {
    const invalidData = createHouseholdBackupDataV2();
    invalidData.paymentPlans[0].categoryId = "missing-category";

    expect(parseHouseholdBackupV2(JSON.stringify(invalidData))).toEqual({
      valid: false,
      error: "invalid-data",
    });
  });
});