const transactionKinds = new Set(["income", "expense"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^(\d{4})-(\d{2})$/;

function isValidISODate(value) {
  if (typeof value !== "string" || !isoDatePattern.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === value;
}

export function validateTransaction(transaction, categories = []) {
  if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
    return { valid: false, errors: ["transaction"] };
  }

  const errors = [];

  if (typeof transaction.id !== "string" || !transaction.id.trim()) {
    errors.push("id");
  }

  if (!transactionKinds.has(transaction.kind)) {
    errors.push("kind");
  }

  if (!isValidISODate(transaction.date)) {
    errors.push("date");
  }

  if (typeof transaction.description !== "string" || !transaction.description.trim()) {
    errors.push("description");
  }

  if (!Number.isSafeInteger(transaction.amountMinor) || transaction.amountMinor < 0) {
    errors.push("amountMinor");
  }

  const selectedCategory = Array.isArray(categories)
    ? categories.find((category) => category.id === transaction.categoryId)
    : undefined;

  if (!selectedCategory) {
    errors.push("categoryId");
  } else if (transactionKinds.has(transaction.kind) && selectedCategory.kind !== transaction.kind) {
    errors.push("categoryKind");
  }

  return { valid: errors.length === 0, errors };
}

export function getMonthSummary(transactions, monthKey) {
  const matchedMonth = typeof monthKey === "string" ? monthPattern.exec(monthKey) : null;
  const monthNumber = matchedMonth ? Number(matchedMonth[2]) : 0;

  if (!matchedMonth || monthNumber < 1 || monthNumber > 12) {
    throw new RangeError("monthKey must use the YYYY-MM format");
  }

  if (!Array.isArray(transactions)) {
    throw new TypeError("transactions must be an array");
  }

  let incomeMinor = 0;
  let expenseMinor = 0;
  let transactionCount = 0;

  for (const transaction of transactions) {
    if (!transaction || typeof transaction.date !== "string" || transaction.date.slice(0, 7) !== monthKey) {
      continue;
    }

    if (!isValidISODate(transaction.date)) {
      throw new TypeError("A transaction in the selected month has an invalid date");
    }

    if (!transactionKinds.has(transaction.kind)) {
      throw new TypeError("A transaction in the selected month has an invalid kind");
    }

    if (!Number.isSafeInteger(transaction.amountMinor) || transaction.amountMinor < 0) {
      throw new TypeError("A transaction in the selected month has an invalid amountMinor");
    }

    if (transaction.kind === "income") {
      incomeMinor += transaction.amountMinor;
      if (!Number.isSafeInteger(incomeMinor)) {
        throw new RangeError("Monthly income exceeds the safe integer range");
      }
    } else {
      expenseMinor += transaction.amountMinor;
      if (!Number.isSafeInteger(expenseMinor)) {
        throw new RangeError("Monthly expenses exceed the safe integer range");
      }
    }

    transactionCount += 1;
  }

  return {
    incomeMinor,
    expenseMinor,
    balanceMinor: incomeMinor - expenseMinor,
    transactionCount,
  };
}

function getCurrencyFractionDigits(currencyCode, locale) {
  if (typeof currencyCode !== "string" || !/^[A-Z]{3}$/.test(currencyCode)) {
    throw new RangeError("currencyCode must be an uppercase ISO 4217 code");
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).resolvedOptions().maximumFractionDigits;
}

export function parseAmountToMinor(value, currencyCode, locale = "es-ES") {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new RangeError("amount must be a non-negative decimal number");
  }

  const fractionDigits = getCurrencyFractionDigits(currencyCode, locale);
  const [wholePart, fractionPart = ""] = value.split(".");

  if (fractionPart.length > fractionDigits) {
    throw new RangeError(`amount supports at most ${fractionDigits} decimal places`);
  }

  const scale = 10n ** BigInt(fractionDigits);
  const wholeMinor = BigInt(wholePart) * scale;
  const fractionMinor = BigInt(fractionPart.padEnd(fractionDigits, "0") || "0");
  const amountMinor = wholeMinor + fractionMinor;

  if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("amount exceeds the safe integer range");
  }

  return Number(amountMinor);
}

export function formatMinorAmount(amountMinor, currencyCode, locale = "es-ES") {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new TypeError("amountMinor must be a safe integer");
  }

  const fractionDigits = getCurrencyFractionDigits(currencyCode, locale);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  });
  return formatter.format(amountMinor / 10 ** fractionDigits);
}