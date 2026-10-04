import { describe, expect, it } from "vitest";
import {
  cancelPaymentPlan,
  createPaymentPlan,
  editPaymentPlan,
  PAYMENT_CARDS,
  validatePaymentPlanInput,
} from "./payments.js";
import { createInitialHouseholdDataV2, isValidHouseholdDataV2 } from "./storage.js";

const categories = [
  { id: "income-other", kind: "income", name: "Otros ingresos" },
  { id: "payment-other", kind: "payment", name: "Otros pagos" },
];

function makePlanInput(overrides = {}) {
  return {
    description: "Compra compartida",
    categoryId: "payment-other",
    responsibility: "shared",
    buyerMemberId: "catriel",
    cardName: "Nación Visa",
    payer: { kind: "member", memberId: "lisandro" },
    currentInstallment: 1,
    totalInstallments: 3,
    firstDueDate: "2026-10-31",
    amountMinor: 12345,
    ...overrides,
  };
}

function createTestIdFactory() {
  let nextId = 0;
  return (prefix) => `${prefix}-${++nextId}`;
}

describe("validatePaymentPlanInput", () => {
  it("accepts valid member cards and named external payers", () => {
    expect(validatePaymentPlanInput(makePlanInput(), categories)).toEqual({ valid: true, errors: [] });
    expect(
      validatePaymentPlanInput(
        makePlanInput({ cardName: null, payer: { kind: "external", name: "Padres" } }),
        categories,
      ),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a card that does not belong to the buyer and invalid installment fields", () => {
    const result = validatePaymentPlanInput(
      makePlanInput({
        buyerMemberId: "lisandro",
        cardName: "Nación Visa",
        currentInstallment: 4,
        totalInstallments: 3,
        firstDueDate: "2026-02-30",
        amountMinor: -1,
      }),
      categories,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "cardName",
      "totalInstallments",
      "firstDueDate",
      "amountMinor",
    ]);
  });

  it("exposes only each member's specified card list", () => {
    expect(PAYMENT_CARDS.lisandro).toEqual([
      "Nación MasterCard",
      "Naranja",
      "Mercado Pago",
      "Mercado Pagos S/Tarjeta",
    ]);
    expect(PAYMENT_CARDS.catriel).toContain("Macro AMEX");
    expect(PAYMENT_CARDS.catriel).toContain("Mercado Pago S/Tarjeta");
  });
});

describe("createPaymentPlan", () => {
  it("generates installments from the current number through the total", () => {
    const paymentPlan = createPaymentPlan(
      makePlanInput({ currentInstallment: 2, totalInstallments: 4 }),
      categories,
      createTestIdFactory(),
    );

    expect(paymentPlan.installments.map(({ number, total, dueDate }) => ({ number, total, dueDate }))).toEqual([
      { number: 2, total: 4, dueDate: "2026-10-31" },
      { number: 3, total: 4, dueDate: "2026-11-30" },
      { number: 4, total: 4, dueDate: "2026-12-31" },
    ]);
    expect(paymentPlan.installments.every((installment) => installment.status === "pending")).toBe(true);
    expect(
      isValidHouseholdDataV2({
        ...createInitialHouseholdDataV2("EUR"),
        paymentPlans: [paymentPlan],
      }),
    ).toBe(true);
  });

  it("anchors end-of-month dates across short months and year boundaries", () => {
    const paymentPlan = createPaymentPlan(
      makePlanInput({ currentInstallment: 1, totalInstallments: 3, firstDueDate: "2026-12-31" }),
      categories,
      createTestIdFactory(),
    );

    expect(paymentPlan.installments.map((installment) => installment.dueDate)).toEqual([
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
    ]);
  });

  it("throws when a plan input is invalid", () => {
    expect(() => createPaymentPlan(makePlanInput({ categoryId: "missing" }), categories)).toThrow(
      TypeError,
    );
  });
});

describe("editPaymentPlan", () => {
  it("updates current and future pending installments without changing paid history", () => {
    const originalPlan = createPaymentPlan(
      makePlanInput({ totalInstallments: 4 }),
      categories,
      createTestIdFactory(),
    );
    originalPlan.installments[0].status = "paid";
    const paidInstallment = { ...originalPlan.installments[0] };
    const pendingIds = originalPlan.installments.slice(1).map((installment) => installment.id);

    const result = editPaymentPlan(
      originalPlan,
      { amountMinor: 15000, totalInstallments: 5 },
      categories,
      createTestIdFactory(),
    );

    expect(result.valid).toBe(true);
    expect(result.plan.installments[0]).toEqual(paidInstallment);
    const updatedPending = result.plan.installments.slice(1);
    expect(updatedPending.slice(0, pendingIds.length).map((installment) => installment.id)).toEqual(
      pendingIds,
    );
    expect(updatedPending.map((installment) => installment.amountMinor)).toEqual([
      15000,
      15000,
      15000,
      15000,
    ]);
    expect(result.plan.installments.at(-1).number).toBe(5);
  });

  it("rejects edits that would remove a paid installment from the plan", () => {
    const originalPlan = createPaymentPlan(
      makePlanInput({ totalInstallments: 4 }),
      categories,
      createTestIdFactory(),
    );
    originalPlan.installments[2].status = "paid";

    expect(editPaymentPlan(originalPlan, { totalInstallments: 2 }, categories)).toEqual({
      valid: false,
      errors: ["totalInstallments"],
    });
  });
});

describe("cancelPaymentPlan", () => {
  it("deletes a plan with no paid installments", () => {
    const paymentPlan = createPaymentPlan(makePlanInput(), categories, createTestIdFactory());

    expect(cancelPaymentPlan(paymentPlan)).toEqual({ action: "delete", plan: null });
  });

  it("preserves paid installments and cancels only future pending installments", () => {
    const paymentPlan = createPaymentPlan(makePlanInput(), categories, createTestIdFactory());
    paymentPlan.installments[0].status = "paid";
    const result = cancelPaymentPlan(paymentPlan);

    expect(result.action).toBe("cancel");
    expect(result.plan.installments).toEqual([paymentPlan.installments[0]]);
    expect(
      isValidHouseholdDataV2({
        ...createInitialHouseholdDataV2("EUR"),
        paymentPlans: [result.plan],
      }),
    ).toBe(true);
  });
});