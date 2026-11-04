import { useSyncExternalStore } from "react";
import type { Farm } from "../types";

const EVENT = "agribridge:active-farm";
const keyFor = (userId: string) => `agribridge:active-farm:${userId}`;

function read(userId: string) {
  try {
    return localStorage.getItem(keyFor(userId)) ?? "";
  } catch {
    return "";
  }
}

let memory: Record<string, string> = {};

export function setActiveFarmId(userId: string | undefined, farmId: string) {
  if (!userId) return;
  memory = { ...memory, [userId]: farmId };
  try {
    localStorage.setItem(keyFor(userId), farmId);
  } catch {
    // Storage can be unavailable; the choice still lasts for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** The farm a farmer last chose, falling back to their first farm. */
export function resolveActiveFarm(farms: Farm[], storedId: string) {
  return farms.find((farm) => farm.id === storedId) ?? farms[0];
}

export function useActiveFarm(userId: string | undefined, farms: Farm[]) {
  const storedId = useSyncExternalStore(
    subscribe,
    () => (userId ? (memory[userId] ?? read(userId)) : ""),
    () => "",
  );
  return resolveActiveFarm(farms, storedId);
}
