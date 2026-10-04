import { describe, expect, it } from "vitest";
import {
  formatMinorAmount,
  getHouseholdMonthSummaryV2,
  getMonthSummary,
  parseAmountToMinor,
  validateTransaction,
} from "./finance.js";
import { createInitialHouseholdDataV2 } from "./storage.js";

const categories = [
  { id: "salary", kind: "income", name: "Salario" },
  { id: "food", kind: "expense", name: "Alimentación" },
];

function makeTransaction(overrides = {}) {
  return {
    id: "transaction-1",
    kind: "expense",
    date: "2026-10-03",
    description: "Compra",
    amountMinor: 1250,
    categoryId: "food",
    ...overrides,
  };
}

describe("validateTransaction", () => {
  it("accepts a valid transaction with a category of the same kind", () => {
    expect(
      validateTransaction(makeTransaction({ kind: "income", categoryId: "salary" }), categories),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects invalid dates, blank descriptions, negative amounts, and mismatched categories", () => {
    const result = validateTransaction(
      makeTransaction({
        date: "2026-02-30",
        description: "  ",
        amountMinor: -1,
        categoryId: "salary",
      }),
      categories,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["date", "description", "amountMinor", "categoryKind"]);
  });

  it("allows a zero amount and rejects missing categories", () => {
    expect(validateTransaction(makeTransaction({ amountMinor: 0 }), categories).valid).toBe(true);
    expect(validateTransaction(makeTransaction({ categoryId: "missing" }), categories).errors).toContain(
      "categoryId",
    );
  });
});

describe("getMonthSummary", () => {
  it("sums only the selected month and computes income minus expenses", () => {
    const transactions = [
      makeTransaction({ id: "income-1", kind: "income", amountMinor: 182500, categoryId: "salary" }),
      makeTransaction({ id: "expense-1", amountMinor: 4250 }),
      makeTransaction({ id: "income-2", kind: "income", date: "2026-10-31", amountMinor: 5000, categoryId: "salary" }),
      makeTransaction({ id: "next-month", date: "2026-11-01", amountMinor: 9000 }),
      makeTransaction({ id: "previous-year", date: "2025-10-03", amountMinor: 3000 }),
    ];

    expect(getMonthSummary(transactions, "2026-10")).toEqual({
      incomeMinor: 187500,
      expenseMinor: 4250,
      balanceMinor: 183250,
      transactionCount: 3,
    });
  });

  it("supports negative balances and returns zero totals for an empty month", () => {
    const transactions = [makeTransaction({ amountMinor: 2500 })];

    expect(getMonthSummary(transactions, "2026-10").balanceMinor).toBe(-2500);
    expect(getMonthSummary([], "2026-12")).toEqual({
      incomeMinor: 0,
      expenseMinor: 0,
      balanceMinor: 0,
      transactionCount: 0,
    });
  });

  it("rejects malformed month keys and totals that exceed safe integer precision", () => {
    expect(() => getMonthSummary([], "2026-13")).toThrow(RangeError);
    expect(() =>
      getMonthSummary(
        [
          makeTransaction({ amountMinor: Number.MAX_SAFE_INTEGER }),
          makeTransaction({ id: "overflow", amountMinor: 1 }),
        ],
        "2026-10",
      ),
    ).toThrow(RangeError);
  });
});

describe("getHouseholdMonthSummaryV2", () => {
  it("calculates member availability, shared cent allocation, and external payer exclusion", () => {
    const householdData = createInitialHouseholdDataV2("EUR");
    householdData.incomeEntries.push(
      {
        id: "income-lisandro",
        memberId: "lisandro",
        date: "2026-10-01",
        description: "Sueldo Lisandro",
        amountMinor: 200000,
        categoryId: "income-other",
      },
      {
        id: "income-catriel",
        memberId: "catriel",
        date: "2026-10-02",
        description: "Sueldo Catriel",
        amountMinor: 100000,
        categoryId: "income-other",
      },
    );
    householdData.paymentPlans.push(
      {
        id: "personal-lisandro",
        description: "Pago personal",
        categoryId: "payment-other",
        responsibility: "lisandro",
        buyerMemberId: "lisandro",
        cardName: null,
        payer: { kind: "member", memberId: "catriel" },
        installments: [
          {
            id: "installment-personal",
            number: 1,
            total: 1,
            dueDate: "2026-10-04",
            amountMinor: 5050,
            status: "paid",
          },
        ],
      },
      {
        id: "shared-plan",
        description: "Compartido impar",
        categoryId: "payment-other",
        responsibility: "shared",
        buyerMemberId: "catriel",
        cardName: "Nación Visa",
        payer: { kind: "member", memberId: "lisandro" },
        installments: [
          {
            id: "installment-shared",
            number: 1,
            total: 1,
            dueDate: "2026-10-10",
            amountMinor: 101,
            status: "pending",
          },
        ],
      },
      {
        id: "external-plan",
        description: "Paga un externo",
        categoryId: "payment-other",
        responsibility: "shared",
        buyerMemberId: "lisandro",
        cardName: "Nación MasterCard",
        payer: { kind: "external", name: "Padres" },
        installments: [
          {
            id: "installment-external",
            number: 1,
            total: 1,
            dueDate: "2026-10-15",
            amountMinor: 300,
            status: "pending",
          },
        ],
      },
      {
        id: "next-month-plan",
        description: "Próximo mes",
        categoryId: "payment-other",
        responsibility: "lisandro",
        buyerMemberId: "lisandro",
        cardName: null,
        payer: { kind: "member", memberId: "lisandro" },
        installments: [
          {
            id: "installment-next-month",
            number: 1,
            total: 1,
            dueDate: "2026-11-01",
            amountMinor: 9900,
            status: "pending",
          },
        ],
      },
    );

    const summary = getHouseholdMonthSummaryV2(householdData, "2026-10");

    expect(summary).toMatchObject({
      incomeMinor: 300000,
      householdPaymentsMinor: 5151,
      sharedHouseholdPaymentsMinor: 101,
      sharedCommitmentsMinor: 401,
      externalPaymentsMinor: 300,
      availableMinor: 294849,
      members: {
        lisandro: {
          incomeMinor: 200000,
          personalPaymentsMinor: 5050,
          sharedPaymentsMinor: 50,
          paymentsMinor: 5100,
          availableMinor: 194900,
        },
        catriel: {
          incomeMinor: 100000,
          personalPaymentsMinor: 0,
          sharedPaymentsMinor: 51,
          paymentsMinor: 51,
          availableMinor: 99949,
        },
      },
    });
  });

  it("counts paid and pending installments equally and filters by due month", () => {
    const householdData = createInitialHouseholdDataV2("EUR");
    householdData.incomeEntries.push({
      id: "income-1",
      memberId: "lisandro",
      date: "2026-10-01",
      description: "Sueldo",
      amountMinor: 50000,
      categoryId: "income-other",
    });
    householdData.paymentPlans.push({
      id: "plan-1",
      description: "Dos cuotas",
      categoryId: "payment-other",
      responsibility: "lisandro",
      buyerMemberId: "lisandro",
      cardName: null,
      payer: { kind: "member", memberId: "lisandro" },
      installments: [
        {
          id: "installment-october",
          number: 1,
          total: 2,
          dueDate: "2026-10-01",
          amountMinor: 10000,
          status: "pending",
        },
        {
          id: "installment-november",
          number: 2,
          total: 2,
          dueDate: "2026-11-01",
          amountMinor: 10000,
          status: "paid",
        },
      ],
    });

    expect(getHouseholdMonthSummaryV2(householdData, "2026-10").members.lisandro.availableMinor).toBe(
      40000,
    );
    expect(getHouseholdMonthSummaryV2(householdData, "2026-11").members.lisandro.availableMinor).toBe(
      -10000,
    );
  });

  it("rejects invalid month keys, entries, and unsafe monthly totals", () => {
    const householdData = createInitialHouseholdDataV2("EUR");

    expect(() => getHouseholdMonthSummaryV2(householdData, "2026-13")).toThrow(RangeError);
    householdData.incomeEntries.push(
      {
        id: "income-1",
        memberId: "lisandro",
        date: "2026-10-01",
        description: "Sueldo",
        amountMinor: Number.MAX_SAFE_INTEGER,
        categoryId: "income-other",
      },
      {
        id: "income-2",
        memberId: "catriel",
        date: "2026-10-02",
        description: "Sueldo",
        amountMinor: 1,
        categoryId: "income-other",
      },
    );

    expect(() => getHouseholdMonthSummaryV2(householdData, "2026-10")).toThrow(RangeError);
  });
});

describe("formatMinorAmount", () => {
  it("uses the currency's number of fraction digits", () => {
    expect(formatMinorAmount(123450, "EUR", "en-US")).toBe("€1,234.50");
    expect(formatMinorAmount(1234, "JPY", "en-US")).toBe("¥1,234");
  });

  it("formats negative balances and rejects invalid input", () => {
    expect(formatMinorAmount(-1250, "USD", "en-US")).toBe("-$12.50");
    expect(() => formatMinorAmount(1.5, "USD")).toThrow(TypeError);
    expect(() => formatMinorAmount(100, "usd")).toThrow(RangeError);
  });
});

describe("parseAmountToMinor", () => {
  it("converts decimal strings using the currency's fraction digits", () => {
    expect(parseAmountToMinor("1234.50", "EUR")).toBe(123450);
    expect(parseAmountToMinor("1234", "JPY")).toBe(1234);
    expect(parseAmountToMinor("1.234", "KWD")).toBe(1234);
  });

  it("rejects excess precision, negative values, and unsafe amounts", () => {
    expect(() => parseAmountToMinor("1.005", "USD")).toThrow(RangeError);
    expect(() => parseAmountToMinor("-1.00", "USD")).toThrow(RangeError);
    expect(() => parseAmountToMinor("90071992547409.92", "USD")).toThrow(RangeError);
  });
});