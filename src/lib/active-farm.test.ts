import { describe, expect, it } from "vitest";
import { resolveActiveFarm } from "./active-farm";
import type { Farm } from "../types";

const farm = (id: string, name: string) => ({ id, name }) as Farm;
const farms = [farm("a", "Kiwoko plot"), farm("b", "Ngoma field")];

describe("resolveActiveFarm", () => {
  it("returns the farm the farmer chose", () => {
    expect(resolveActiveFarm(farms, "b")?.name).toBe("Ngoma field");
  });
  it("falls back to the first farm when nothing or a removed farm is stored", () => {
    expect(resolveActiveFarm(farms, "")?.id).toBe("a");
    expect(resolveActiveFarm(farms, "gone")?.id).toBe("a");
  });
  it("returns nothing when the farmer has no farms", () => {
    expect(resolveActiveFarm([], "a")).toBeUndefined();
  });
});
