import { describe, expect, it, vi } from "vitest";
import { createInitialFinanceData, loadFinanceData, saveFinanceData, STORAGE_KEY } from "./storage.js";

function createStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((key, nextValue) => {
      value = nextValue;
    }),
    getValue: () => value,
  };
}

function createSavedData() {
  const data = createInitialFinanceData();
  data.settings.currencyCode = "EUR";
  data.transactions.push({
    id: "transaction-1",
    kind: "expense",
    date: "2026-10-03",
    description: "Compra",
    amountMinor: 1250,
    categoryId: "expense-other",
  });
  data.balances.savingsMinor = 25000;
  return data;
}

describe("loadFinanceData", () => {
  it("returns the initial household data when no saved value exists", () => {
    const result = loadFinanceData(createStorage());

    expect(result.status).toBe("available");
    expect(result.data).toEqual(createInitialFinanceData());
  });

  it("loads a valid versioned dataset saved under the expected key", () => {
    const savedData = createSavedData();
    const storage = createStorage(JSON.stringify(savedData));

    expect(loadFinanceData(storage)).toEqual({ data: savedData, status: "available" });
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("rejects malformed JSON and unsupported schema versions without using the data", () => {
    expect(loadFinanceData(createStorage("{"))).toEqual({
      data: createInitialFinanceData(),
      status: "invalid",
    });

    const incompatibleData = { ...createSavedData(), schemaVersion: 2 };
    expect(loadFinanceData(createStorage(JSON.stringify(incompatibleData))).status).toBe("invalid");
  });

  it("falls back to initial in-memory data when storage access throws", () => {
    const blockedStorage = { getItem: () => { throw new Error("blocked"); } };

    expect(loadFinanceData(blockedStorage)).toEqual({
      data: createInitialFinanceData(),
      status: "unavailable",
    });
  });
});

describe("saveFinanceData", () => {
  it("serializes valid data to the versioned key and reports success", () => {
    const storage = createStorage();
    const data = createSavedData();

    expect(saveFinanceData(data, storage)).toEqual({ status: "saved" });
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(data));
    expect(JSON.parse(storage.getValue())).toEqual(data);
  });

  it("reports unavailable storage without throwing when writing fails", () => {
    const blockedStorage = { setItem: () => { throw new Error("quota"); } };

    expect(saveFinanceData(createSavedData(), blockedStorage)).toEqual({ status: "unavailable" });
  });

  it("refuses to persist invalid finance data", () => {
    const storage = createStorage();
    const invalidData = { ...createSavedData(), balances: { savingsMinor: -1, debtMinor: 0 } };

    expect(saveFinanceData(invalidData, storage)).toEqual({ status: "invalid" });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});