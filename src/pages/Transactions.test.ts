import { describe, expect, it } from "vitest";
import { counterparty, transactionTotals } from "./Transactions";
import type { Transaction } from "../types";

const item = (overrides: Partial<Transaction>) =>
  ({
    kind: "sell",
    status: "pending",
    totalUgx: 1000,
    buyer: "Buyer",
    seller: "Me",
    ...overrides,
  }) as Transaction;

describe("transactions", () => {
  it("totals sales and purchases without cancelled records", () => {
    const totals = transactionTotals([
      item({ totalUgx: 5000, status: "delivered" }),
      item({ totalUgx: 2000 }),
      item({ kind: "buy", totalUgx: 700, status: "confirmed" }),
      item({ totalUgx: 9999, status: "cancelled" }),
    ]);
    expect(totals).toEqual({
      count: 4,
      sales: 7000,
      purchases: 700,
      pending: 1,
    });
  });
  it("shows the other party for sales and purchases", () => {
    expect(counterparty(item({}))).toBe("Buyer");
    expect(counterparty(item({ kind: "buy", seller: "Shop" }))).toBe("Shop");
  });
});
