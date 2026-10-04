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

function addSafeAmount(target, key, amountMinor, label) {
  const total = target[key] + amountMinor;
  if (!Number.isSafeInteger(total)) {
    throw new RangeError(`${label} exceeds the safe integer range`);
  }
  target[key] = total;
}

export function getHouseholdMonthSummaryV2(householdData, monthKey) {
  const matchedMonth = typeof monthKey === "string" ? monthPattern.exec(monthKey) : null;
  const monthNumber = matchedMonth ? Number(matchedMonth[2]) : 0;
  if (!matchedMonth || monthNumber < 1 || monthNumber > 12) {
    throw new RangeError("monthKey must use the YYYY-MM format");
  }

  if (
    !householdData ||
    typeof householdData !== "object" ||
    !Array.isArray(householdData.incomeEntries) ||
    !Array.isArray(householdData.paymentPlans)
  ) {
    throw new TypeError("householdData must contain incomeEntries and paymentPlans arrays");
  }

  const members = {
    lisandro: {
      incomeMinor: 0,
      personalPaymentsMinor: 0,
      sharedPaymentsMinor: 0,
      paymentsMinor: 0,
      availableMinor: 0,
    },
    catriel: {
      incomeMinor: 0,
      personalPaymentsMinor: 0,
      sharedPaymentsMinor: 0,
      paymentsMinor: 0,
      availableMinor: 0,
    },
  };
  const summary = {
    monthKey,
    incomeMinor: 0,
    householdPaymentsMinor: 0,
    sharedHouseholdPaymentsMinor: 0,
    sharedCommitmentsMinor: 0,
    externalPaymentsMinor: 0,
    availableMinor: 0,
    members,
  };

  for (const incomeEntry of householdData.incomeEntries) {
    if (
      !incomeEntry ||
      !["lisandro", "catriel"].includes(incomeEntry.memberId) ||
      !isValidISODate(incomeEntry.date) ||
      !Number.isSafeInteger(incomeEntry.amountMinor) ||
      incomeEntry.amountMinor < 0
    ) {
      throw new TypeError("householdData contains an invalid income entry");
    }

    if (incomeEntry.date.slice(0, 7) !== monthKey) continue;
    addSafeAmount(members[incomeEntry.memberId], "incomeMinor", incomeEntry.amountMinor, "Member income");
    addSafeAmount(summary, "incomeMinor", incomeEntry.amountMinor, "Monthly income");
  }

  for (const paymentPlan of householdData.paymentPlans) {
    if (
      !paymentPlan ||
      !["lisandro", "catriel", "shared"].includes(paymentPlan.responsibility) ||
      !["lisandro", "catriel"].includes(paymentPlan.buyerMemberId) ||
      !paymentPlan.payer ||
      !["member", "external"].includes(paymentPlan.payer.kind) ||
      (paymentPlan.payer.kind === "member" && !["lisandro", "catriel"].includes(paymentPlan.payer.memberId)) ||
      (paymentPlan.payer.kind === "external" &&
        (typeof paymentPlan.payer.name !== "string" || !paymentPlan.payer.name.trim())) ||
      !Array.isArray(paymentPlan.installments)
    ) {
      throw new TypeError("householdData contains an invalid payment plan");
    }

    for (const installment of paymentPlan.installments) {
      if (
        !installment ||
        !isValidISODate(installment.dueDate) ||
        !Number.isSafeInteger(installment.amountMinor) ||
        installment.amountMinor < 0 ||
        !["pending", "paid"].includes(installment.status)
      ) {
        throw new TypeError("householdData contains an invalid installment");
      }

      if (installment.dueDate.slice(0, 7) !== monthKey) continue;

      if (paymentPlan.responsibility === "shared") {
        addSafeAmount(
          summary,
          "sharedCommitmentsMinor",
          installment.amountMinor,
          "Monthly shared commitments",
        );
      }

      if (paymentPlan.payer.kind === "external") {
        addSafeAmount(
          summary,
          "externalPaymentsMinor",
          installment.amountMinor,
          "Externally paid installments",
        );
        continue;
      }

      addSafeAmount(
        summary,
        "householdPaymentsMinor",
        installment.amountMinor,
        "Monthly household payments",
      );

      if (paymentPlan.responsibility === "shared") {
        const baseShare = Math.floor(installment.amountMinor / 2);
        const buyerRemainder = installment.amountMinor - baseShare * 2;
        const lisandroShare = baseShare + (paymentPlan.buyerMemberId === "lisandro" ? buyerRemainder : 0);
        const catrielShare = baseShare + (paymentPlan.buyerMemberId === "catriel" ? buyerRemainder : 0);

        addSafeAmount(members.lisandro, "sharedPaymentsMinor", lisandroShare, "Lisandro shared payments");
        addSafeAmount(members.catriel, "sharedPaymentsMinor", catrielShare, "Catriel shared payments");
        addSafeAmount(
          summary,
          "sharedHouseholdPaymentsMinor",
          installment.amountMinor,
          "Monthly shared household payments",
        );
      } else {
        addSafeAmount(
          members[paymentPlan.responsibility],
          "personalPaymentsMinor",
          installment.amountMinor,
          "Personal payments",
        );
      }
    }
  }

  for (const member of Object.values(members)) {
    member.paymentsMinor = member.personalPaymentsMinor + member.sharedPaymentsMinor;
    member.availableMinor = member.incomeMinor - member.paymentsMinor;
    summary.availableMinor += member.availableMinor;
  }

  return summary;
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