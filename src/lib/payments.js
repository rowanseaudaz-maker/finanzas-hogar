export const PAYMENT_CARDS = {
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

const memberIds = new Set(["lisandro", "catriel"]);
const responsibilities = new Set(["lisandro", "catriel", "shared"]);

function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === value;
}

function createId(prefix) {
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uniqueId}`;
}

function getDueDateForOffset(firstDueDate, monthOffset) {
  const [year, month, day] = firstDueDate.split("-").map(Number);
  const targetMonth = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const dueDay = String(Math.min(day, lastDay)).padStart(2, "0");
  const dueMonth = String(targetMonth.getUTCMonth() + 1).padStart(2, "0");
  return `${targetMonth.getUTCFullYear()}-${dueMonth}-${dueDay}`;
}

function normalizePayer(payer) {
  return payer.kind === "external"
    ? { kind: "external", name: payer.name.trim() }
    : { kind: "member", memberId: payer.memberId };
}

function generateInstallments(input, idFactory, existingInstallments = []) {
  const existingIdsByNumber = new Map(
    existingInstallments.map((installment) => [installment.number, installment.id]),
  );
  const installments = [];

  for (let number = input.currentInstallment; number <= input.totalInstallments; number += 1) {
    const monthOffset = number - input.currentInstallment;
    installments.push({
      id: existingIdsByNumber.get(number) ?? idFactory("installment"),
      number,
      total: input.totalInstallments,
      dueDate: getDueDateForOffset(input.firstDueDate, monthOffset),
      amountMinor: input.amountMinor,
      status: "pending",
    });
  }

  return installments;
}

export function validatePaymentPlanInput(input, categories) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["plan"] };
  }

  const errors = [];
  const category = Array.isArray(categories)
    ? categories.find((item) => item.id === input.categoryId)
    : undefined;

  if (typeof input.description !== "string" || !input.description.trim()) errors.push("description");
  if (category?.kind !== "payment") errors.push("categoryId");
  if (!responsibilities.has(input.responsibility)) errors.push("responsibility");
  if (!memberIds.has(input.buyerMemberId)) errors.push("buyerMemberId");

  const cardName = input.cardName ?? null;
  if (
    cardName !== null &&
    (typeof cardName !== "string" || !PAYMENT_CARDS[input.buyerMemberId]?.includes(cardName))
  ) {
    errors.push("cardName");
  }

  if (!input.payer || typeof input.payer !== "object") {
    errors.push("payer");
  } else if (input.payer.kind === "member") {
    if (!memberIds.has(input.payer.memberId)) errors.push("payer");
  } else if (input.payer.kind === "external") {
    if (typeof input.payer.name !== "string" || !input.payer.name.trim()) errors.push("payer");
  } else {
    errors.push("payer");
  }

  if (!Number.isSafeInteger(input.currentInstallment) || input.currentInstallment < 1) {
    errors.push("currentInstallment");
  }

  if (
    !Number.isSafeInteger(input.totalInstallments) ||
    input.totalInstallments < input.currentInstallment
  ) {
    errors.push("totalInstallments");
  }

  if (!isValidISODate(input.firstDueDate)) errors.push("firstDueDate");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) errors.push("amountMinor");

  return { valid: errors.length === 0, errors };
}

export function createPaymentPlan(input, categories, idFactory = createId) {
  const validation = validatePaymentPlanInput(input, categories);
  if (!validation.valid) {
    throw new TypeError(`Invalid payment plan: ${validation.errors.join(", ")}`);
  }

  return {
    id: idFactory("plan"),
    description: input.description.trim(),
    categoryId: input.categoryId,
    responsibility: input.responsibility,
    buyerMemberId: input.buyerMemberId,
    cardName: input.cardName ?? null,
    payer: normalizePayer(input.payer),
    installments: generateInstallments(input, idFactory),
  };
}

export function editPaymentPlan(plan, changes, categories, idFactory = createId) {
  const paidInstallments = plan.installments.filter((installment) => installment.status === "paid");
  const pendingInstallments = plan.installments.filter((installment) => installment.status === "pending");
  if (pendingInstallments.length === 0) {
    return { valid: false, errors: ["noPendingInstallments"] };
  }

  const firstPending = pendingInstallments[0];
  const input = {
    description: changes.description ?? plan.description,
    categoryId: changes.categoryId ?? plan.categoryId,
    responsibility: changes.responsibility ?? plan.responsibility,
    buyerMemberId: changes.buyerMemberId ?? plan.buyerMemberId,
    cardName: changes.cardName === undefined ? plan.cardName : changes.cardName,
    payer: changes.payer ?? plan.payer,
    currentInstallment: firstPending.number,
    totalInstallments: changes.totalInstallments ?? firstPending.total,
    firstDueDate: changes.firstDueDate ?? firstPending.dueDate,
    amountMinor: changes.amountMinor ?? firstPending.amountMinor,
  };
  const validation = validatePaymentPlanInput(input, categories);
  const latestPaidNumber = paidInstallments.at(-1)?.number ?? 0;

  if (input.totalInstallments < latestPaidNumber) {
    validation.errors.push("totalInstallments");
    validation.valid = false;
  }

  if (!validation.valid) return validation;

  const updatedPending = generateInstallments(input, idFactory, pendingInstallments);
  const installments = [...paidInstallments, ...updatedPending].sort(
    (first, second) => first.number - second.number,
  );

  return {
    valid: true,
    plan: {
      ...plan,
      description: input.description.trim(),
      categoryId: input.categoryId,
      responsibility: input.responsibility,
      buyerMemberId: input.buyerMemberId,
      cardName: input.cardName,
      payer: normalizePayer(input.payer),
      installments,
    },
  };
}

export function cancelPaymentPlan(plan) {
  const paidInstallments = plan.installments.filter((installment) => installment.status === "paid");
  if (paidInstallments.length === 0) return { action: "delete", plan: null };

  return {
    action: "cancel",
    plan: { ...plan, installments: paidInstallments },
  };
}