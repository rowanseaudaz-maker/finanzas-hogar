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

export const STORAGE_KEY_V2 = "finanzas-hogar:v2";
export const DATA_SCHEMA_VERSION_V2 = 2;

const v2Members = [
  { id: "lisandro", name: "Lisandro" },
  { id: "catriel", name: "Catriel" },
];

const v2InitialCategories = [
  { id: "income-other", kind: "income", name: "Otros ingresos" },
  { id: "payment-other", kind: "payment", name: "Otros pagos" },
];

const memberCards = {
  lisandro: ["Nación MasterCard", "Naranja", "Mercado Pago", "Mercado Pagos S/Tarjeta"],
  catriel: [
    "Nación Visa",
    "Nación MasterCard",
    "Macro Visa",
    "Macro AMEX",
    "Naranja",
    "Mercado Pago",
    "Mercado Pago S/Tarjeta",
  ],
};

function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === value;
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidV2Category(category) {
  return (
    category &&
    typeof category === "object" &&
    typeof category.id === "string" &&
    Boolean(category.id.trim()) &&
    ["income", "payment"].includes(category.kind) &&
    typeof category.name === "string" &&
    Boolean(category.name.trim())
  );
}

function isValidV2IncomeEntry(entry, categories) {
  const category = categories.find((item) => item.id === entry?.categoryId);
  return (
    entry &&
    typeof entry === "object" &&
    typeof entry.id === "string" &&
    Boolean(entry.id.trim()) &&
    ["lisandro", "catriel"].includes(entry.memberId) &&
    isValidISODate(entry.date) &&
    typeof entry.description === "string" &&
    Boolean(entry.description.trim()) &&
    isNonNegativeSafeInteger(entry.amountMinor) &&
    category?.kind === "income"
  );
}

function isValidV2Payer(payer) {
  if (!payer || typeof payer !== "object") return false;
  if (payer.kind === "member") return ["lisandro", "catriel"].includes(payer.memberId);
  return payer.kind === "external" && typeof payer.name === "string" && Boolean(payer.name.trim());
}

function isValidV2PaymentPlan(plan, categories) {
  if (!plan || typeof plan !== "object") return false;

  const category = categories.find((item) => item.id === plan.categoryId);
  if (
    typeof plan.id !== "string" ||
    !plan.id.trim() ||
    typeof plan.description !== "string" ||
    !plan.description.trim() ||
    category?.kind !== "payment" ||
    !["lisandro", "catriel", "shared"].includes(plan.responsibility) ||
    !["lisandro", "catriel"].includes(plan.buyerMemberId) ||
    !(plan.cardName === null || memberCards[plan.buyerMemberId].includes(plan.cardName)) ||
    !isValidV2Payer(plan.payer) ||
    !Array.isArray(plan.installments) ||
    plan.installments.length === 0
  ) {
    return false;
  }

  const installmentIds = new Set();
  let previousNumber = null;
  let totalInstallments = null;

  for (const installment of plan.installments) {
    if (
      !installment ||
      typeof installment !== "object" ||
      typeof installment.id !== "string" ||
      !installment.id.trim() ||
      installmentIds.has(installment.id) ||
      !Number.isSafeInteger(installment.number) ||
      installment.number < 1 ||
      (previousNumber !== null && installment.number !== previousNumber + 1) ||
      !Number.isSafeInteger(installment.total) ||
      installment.total < installment.number ||
      !isValidISODate(installment.dueDate) ||
      !isNonNegativeSafeInteger(installment.amountMinor) ||
      !["pending", "paid"].includes(installment.status)
    ) {
      return false;
    }

    if (totalInstallments !== null && installment.total !== totalInstallments) return false;
    installmentIds.add(installment.id);
    previousNumber = installment.number;
    totalInstallments = installment.total;
  }

  return true;
}

export function createInitialHouseholdDataV2(currencyCode = null) {
  return {
    schemaVersion: DATA_SCHEMA_VERSION_V2,
    settings: { currencyCode },
    members: v2Members.map((member) => ({ ...member })),
    categories: v2InitialCategories.map((category) => ({ ...category })),
    incomeEntries: [],
    paymentPlans: [],
    balances: {
      lisandro: { savingsMinor: 0, debtMinor: 0 },
      catriel: { savingsMinor: 0, debtMinor: 0 },
    },
  };
}

export function isValidHouseholdDataV2(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (data.schemaVersion !== DATA_SCHEMA_VERSION_V2) return false;
  if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) return false;
  if (!Array.isArray(data.members) || !Array.isArray(data.categories)) return false;
  if (!Array.isArray(data.incomeEntries) || !Array.isArray(data.paymentPlans)) return false;
  if (!data.balances || typeof data.balances !== "object" || Array.isArray(data.balances)) return false;

  const currencyCode = data.settings.currencyCode;
  if (currencyCode !== null && (typeof currencyCode !== "string" || !/^[A-Z]{3}$/.test(currencyCode))) {
    return false;
  }

  if (
    data.members.length !== v2Members.length ||
    v2Members.some(
      (member, index) =>
        data.members[index]?.id !== member.id || data.members[index]?.name !== member.name,
    )
  ) {
    return false;
  }

  const categoryIds = new Set();
  for (const category of data.categories) {
    if (!isValidV2Category(category) || categoryIds.has(category.id)) return false;
    categoryIds.add(category.id);
  }

  if (!data.categories.some((category) => category.kind === "income")) return false;
  if (!data.categories.some((category) => category.kind === "payment")) return false;

  const incomeIds = new Set();
  for (const incomeEntry of data.incomeEntries) {
    if (!isValidV2IncomeEntry(incomeEntry, data.categories) || incomeIds.has(incomeEntry.id)) return false;
    incomeIds.add(incomeEntry.id);
  }

  const planIds = new Set();
  for (const paymentPlan of data.paymentPlans) {
    if (!isValidV2PaymentPlan(paymentPlan, data.categories) || planIds.has(paymentPlan.id)) return false;
    planIds.add(paymentPlan.id);
  }

  for (const memberId of ["lisandro", "catriel"]) {
    const balance = data.balances[memberId];
    if (
      !balance ||
      !isNonNegativeSafeInteger(balance.savingsMinor) ||
      !isNonNegativeSafeInteger(balance.debtMinor)
    ) {
      return false;
    }
  }

  if (currencyCode === null && (data.incomeEntries.length > 0 || data.paymentPlans.length > 0)) return false;
  return true;
}

function readLegacyCurrencyCode(storage) {
  const serializedLegacyData = storage.getItem(STORAGE_KEY);
  if (serializedLegacyData === null) return null;

  try {
    const legacyData = JSON.parse(serializedLegacyData);
    return isValidFinanceData(legacyData) ? legacyData.settings.currencyCode : null;
  } catch {
    return null;
  }
}

export function loadHouseholdDataV2(storage) {
  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage || typeof targetStorage.getItem !== "function") {
      return { data: createInitialHouseholdDataV2(), status: "unavailable" };
    }

    const serializedData = targetStorage.getItem(STORAGE_KEY_V2);
    if (serializedData === null) {
      return {
        data: createInitialHouseholdDataV2(readLegacyCurrencyCode(targetStorage)),
        status: "available",
      };
    }

    let data;
    try {
      data = JSON.parse(serializedData);
    } catch {
      return {
        data: createInitialHouseholdDataV2(readLegacyCurrencyCode(targetStorage)),
        status: "invalid",
      };
    }

    if (!isValidHouseholdDataV2(data)) {
      return {
        data: createInitialHouseholdDataV2(readLegacyCurrencyCode(targetStorage)),
        status: "invalid",
      };
    }

    return { data, status: "available" };
  } catch {
    return { data: createInitialHouseholdDataV2(), status: "unavailable" };
  }
}

export function saveHouseholdDataV2(data, storage) {
  if (!isValidHouseholdDataV2(data)) return { status: "invalid" };

  try {
    const targetStorage = getStorage(storage);
    if (!targetStorage || typeof targetStorage.setItem !== "function") {
      return { status: "unavailable" };
    }

    targetStorage.setItem(STORAGE_KEY_V2, JSON.stringify(data));
    return { status: "saved" };
  } catch {
    return { status: "unavailable" };
  }
}