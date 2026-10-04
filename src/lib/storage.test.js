import { describe, expect, it, vi } from "vitest";
import {
  createInitialFinanceData,
  createInitialHouseholdDataV2,
  isValidHouseholdDataV2,
  loadFinanceData,
  loadHouseholdDataV2,
  saveFinanceData,
  saveHouseholdDataV2,
  STORAGE_KEY,
  STORAGE_KEY_V2,
} from "./storage.js";

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

function createKeyedStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    getValue: (key) => values.get(key) ?? null,
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

function createHouseholdDataV2() {
  const data = createInitialHouseholdDataV2("EUR");
  data.incomeEntries.push({
    id: "income-1",
    memberId: "lisandro",
    date: "2026-10-01",
    description: "Sueldo",
    amountMinor: 250000,
    categoryId: "income-other",
  });
  data.paymentPlans.push({
    id: "plan-1",
    description: "Compra compartida",
    categoryId: "payment-other",
    responsibility: "shared",
    buyerMemberId: "catriel",
    cardName: "Nación Visa",
    payer: { kind: "member", memberId: "lisandro" },
    installments: [
      {
        id: "installment-1",
        number: 1,
        total: 2,
        dueDate: "2026-10-31",
        amountMinor: 12345,
        status: "pending",
      },
      {
        id: "installment-2",
        number: 2,
        total: 2,
        dueDate: "2026-11-30",
        amountMinor: 12345,
        status: "pending",
      },
    ],
  });
  data.balances.lisandro.savingsMinor = 50000;
  return data;
}

describe("loadHouseholdDataV2", () => {
  it("creates an empty v2 model without a currency when no v1 model exists", () => {
    const storage = createKeyedStorage();

    expect(loadHouseholdDataV2(storage)).toEqual({
      data: createInitialHouseholdDataV2(),
      status: "available",
    });
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY_V2);
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("copies only the valid v1 currency and leaves all v1 data unchanged", () => {
    const legacyData = createSavedData();
    const serializedLegacyData = JSON.stringify(legacyData);
    const storage = createKeyedStorage({ [STORAGE_KEY]: serializedLegacyData });
    const result = loadHouseholdDataV2(storage);

    expect(result.status).toBe("available");
    expect(result.data).toEqual(createInitialHouseholdDataV2("EUR"));
    expect(storage.getValue(STORAGE_KEY)).toBe(serializedLegacyData);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("loads valid v2 data and rejects invalid schemas without changing v1", () => {
    const data = createHouseholdDataV2();
    const storage = createKeyedStorage({ [STORAGE_KEY_V2]: JSON.stringify(data) });

    expect(loadHouseholdDataV2(storage)).toEqual({ data, status: "available" });

    const unsupportedData = { ...data, schemaVersion: 3 };
    const invalidStorage = createKeyedStorage({
      [STORAGE_KEY]: JSON.stringify(createSavedData()),
      [STORAGE_KEY_V2]: JSON.stringify(unsupportedData),
    });
    const invalidResult = loadHouseholdDataV2(invalidStorage);

    expect(invalidResult.status).toBe("invalid");
    expect(invalidResult.data.settings.currencyCode).toBe("EUR");
    expect(invalidStorage.getValue(STORAGE_KEY)).toBe(JSON.stringify(createSavedData()));
  });

  it("rejects incomes without a matching income category", () => {
    const data = createHouseholdDataV2();
    data.incomeEntries[0].categoryId = "payment-other";

    expect(isValidHouseholdDataV2(data)).toBe(false);
  });

  it("accepts a plan schedule that starts at its current installment", () => {
    const data = createHouseholdDataV2();
    data.paymentPlans[0].installments = data.paymentPlans[0].installments.filter(
      (installment) => installment.number >= 2,
    );

    expect(isValidHouseholdDataV2(data)).toBe(true);
  });

  it("reports unavailable storage without throwing", () => {
    const blockedStorage = { getItem: () => { throw new Error("blocked"); } };

    expect(loadHouseholdDataV2(blockedStorage)).toEqual({
      data: createInitialHouseholdDataV2(),
      status: "unavailable",
    });
  });
});

describe("saveHouseholdDataV2", () => {
  it("writes valid v2 data only to its own key", () => {
    const legacyData = JSON.stringify(createSavedData());
    const storage = createKeyedStorage({ [STORAGE_KEY]: legacyData });
    const data = createHouseholdDataV2();

    expect(saveHouseholdDataV2(data, storage)).toEqual({ status: "saved" });
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY_V2, JSON.stringify(data));
    expect(storage.getValue(STORAGE_KEY)).toBe(legacyData);
    expect(JSON.parse(storage.getValue(STORAGE_KEY_V2))).toEqual(data);
  });

  it("refuses invalid v2 data and handles storage write failures", () => {
    const storage = createKeyedStorage();
    const invalidData = createHouseholdDataV2();
    invalidData.balances.lisandro.debtMinor = -1;

    expect(saveHouseholdDataV2(invalidData, storage)).toEqual({ status: "invalid" });
    expect(storage.setItem).not.toHaveBeenCalled();

    const blockedStorage = { setItem: () => { throw new Error("quota"); } };
    expect(saveHouseholdDataV2(createHouseholdDataV2(), blockedStorage)).toEqual({ status: "unavailable" });
  });
});