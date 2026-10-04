import { validateTransaction } from "./finance.js";

export const STORAGE_KEY = "finanzas-hogar:v1";
export const DATA_SCHEMA_VERSION = 1;

const initialCategories = [
  { id: "income-other", kind: "income", name: "Otros ingresos" },
  { id: "expense-other", kind: "expense", name: "Otros gastos" },
];

export function createInitialFinanceData() {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    settings: { currencyCode: null },
    categories: initialCategories.map((category) => ({ ...category })),
    transactions: [],
    balances: { savingsMinor: 0, debtMinor: 0 },
  };
}

export function isValidFinanceData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (data.schemaVersion !== DATA_SCHEMA_VERSION) return false;
  if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) return false;
  if (!data.balances || typeof data.balances !== "object" || Array.isArray(data.balances)) return false;
  if (!Array.isArray(data.categories) || !Array.isArray(data.transactions)) return false;

  const currencyCode = data.settings.currencyCode;
  if (currencyCode !== null && (typeof currencyCode !== "string" || !/^[A-Z]{3}$/.test(currencyCode))) {
    return false;
  }

  if (
    !Number.isSafeInteger(data.balances.savingsMinor) ||
    data.balances.savingsMinor < 0 ||
    !Number.isSafeInteger(data.balances.debtMinor) ||
    data.balances.debtMinor < 0
  ) {
    return false;
  }

  const categoryIds = new Set();
  for (const category of data.categories) {
    if (
      !category ||
      typeof category !== "object" ||
      typeof category.id !== "string" ||
      !category.id.trim() ||
      categoryIds.has(category.id) ||
      !["income", "expense"].includes(category.kind) ||
      typeof category.name !== "string" ||
      !category.name.trim()
    ) {
      return false;
    }
    categoryIds.add(category.id);
  }

  if (!data.categories.some((category) => category.kind === "income")) return false;
  if (!data.categories.some((category) => category.kind === "expense")) return false;

  const transactionIds = new Set();
  for (const transaction of data.transactions) {
    if (
      !validateTransaction(transaction, data.categories).valid ||
      transactionIds.has(transaction.id)
    ) {
      return false;
    }
    transactionIds.add(transaction.id);
  }

  if (currencyCode === null && data.transactions.length > 0) return false;
  return true;
}

function getStorage(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

export function loadFinanceData(storage) {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage || typeof targetStorage.getItem !== "function") {
      return { data: createInitialFinanceData(), status: "unavailable" };
    }

    const serializedData = targetStorage.getItem(STORAGE_KEY);
    if (serializedData === null) {
      return { data: createInitialFinanceData(), status: "available" };
    }

    let data;
    try {
      data = JSON.parse(serializedData);
    } catch {
      return { data: createInitialFinanceData(), status: "invalid" };
    }

    if (!isValidFinanceData(data)) {
      return { data: createInitialFinanceData(), status: "invalid" };
    }

    return { data, status: "available" };
  } catch {
    return { data: createInitialFinanceData(), status: "unavailable" };
  }
}

export function saveFinanceData(data, storage) {
  if (!isValidFinanceData(data)) {
    return { status: "invalid" };
  }

  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage || typeof targetStorage.setItem !== "function") {
      return { status: "unavailable" };
    }

    targetStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { status: "saved" };
  } catch {
    return { status: "unavailable" };
  }
}