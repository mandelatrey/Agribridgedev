import type { Season, Transaction } from "../types";

const DAY = 86_400_000;
const monthKey = (value: string) => value.slice(0, 7);
function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

/** Recorded sales per calendar month, oldest first, ending with `today`'s month. */
export function monthlySales(
  transactions: Transaction[],
  today: string,
  months = 6,
) {
  const end = monthKey(today);
  const keys = Array.from({ length: months }, (_, index) =>
    shiftMonth(end, index - months + 1),
  );
  return keys.map((key) => ({
    month: key,
    totalUgx: transactions
      .filter(
        (item) =>
          item.kind === "sell" &&
          item.status !== "cancelled" &&
          monthKey(item.transactionDate) === key,
      )
      .reduce((sum, item) => sum + item.totalUgx, 0),
  }));
}

/** Percent change from the previous month; null when there is nothing to compare. */
export function monthChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** How far a season is between planting and expected harvest. */
export function seasonProgress(season: Season, today: string) {
  const start = Date.parse(season.plantingDate);
  const end = Date.parse(season.expectedHarvestDate);
  const now = Date.parse(today);
  const totalDays = Math.max(1, Math.round((end - start) / DAY));
  const elapsed = Math.min(
    totalDays,
    Math.max(0, Math.round((now - start) / DAY)),
  );
  return {
    totalDays,
    elapsedDays: elapsed,
    daysLeft: Math.max(0, Math.round((end - now) / DAY)),
    ratio: elapsed / totalDays,
    harvestRatio:
      season.expectedHarvestKg > 0
        ? Math.min(1, season.harvestedKg / season.expectedHarvestKg)
        : 0,
  };
}

/** The active season for a farm, or the latest planned one. */
export function focusSeason(seasons: Season[], farmId: string) {
  const forFarm = seasons.filter(
    (season) => !farmId || season.farmId === farmId,
  );
  return (
    forFarm.find((season) => season.status === "active") ??
    forFarm.find((season) => season.status === "planning")
  );
}
