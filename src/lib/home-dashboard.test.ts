import { describe, expect, it } from "vitest";
import {
  focusSeason,
  monthChange,
  monthlySales,
  seasonProgress,
} from "./home-dashboard";
import type { Season, Transaction } from "../types";

const sale = (transactionDate: string, totalUgx: number, extra = {}) =>
  ({
    kind: "sell",
    status: "delivered",
    transactionDate,
    totalUgx,
    ...extra,
  }) as Transaction;

describe("home dashboard data", () => {
  it("groups recorded sales by month and skips purchases and cancellations", () => {
    const months = monthlySales(
      [
        sale("2026-11-02", 1000),
        sale("2026-11-03", 500),
        sale("2026-10-20", 700),
        sale("2026-10-21", 9000, { kind: "buy" }),
        sale("2026-09-01", 9000, { status: "cancelled" }),
        sale("2025-11-01", 9000),
      ],
      "2026-11-04",
      3,
    );
    expect(months).toEqual([
      { month: "2026-09", totalUgx: 0 },
      { month: "2026-10", totalUgx: 700 },
      { month: "2026-11", totalUgx: 1500 },
    ]);
  });
  it("crosses a year boundary", () => {
    expect(monthlySales([], "2026-01-15", 2).map((m) => m.month)).toEqual([
      "2025-12",
      "2026-01",
    ]);
  });
  it("reports change only when last month had sales", () => {
    expect(monthChange(1500, 1000)).toBe(50);
    expect(monthChange(500, 0)).toBeNull();
  });
  it("measures season progress within its dates", () => {
    const season = {
      plantingDate: "2026-09-01",
      expectedHarvestDate: "2026-12-10",
      expectedHarvestKg: 1000,
      harvestedKg: 250,
      status: "active",
      farmId: "a",
    } as Season;
    const progress = seasonProgress(season, "2026-11-04");
    expect(progress.totalDays).toBe(100);
    expect(progress.elapsedDays).toBe(64);
    expect(progress.daysLeft).toBe(36);
    expect(progress.harvestRatio).toBe(0.25);
    expect(seasonProgress(season, "2027-01-01").ratio).toBe(1);
    expect(focusSeason([season], "a")).toBe(season);
    expect(focusSeason([season], "b")).toBeUndefined();
  });
});
