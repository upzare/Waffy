import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function equalJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const left = Object.entries(a);
  const right = b as Record<string, unknown>;
  return (
    left.length === Object.keys(right).length &&
    left.every(([key, value]) => Object.hasOwn(right, key) && equalJson(value, right[key]))
  );
}
