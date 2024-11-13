import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("Invalid time format");
  }
  return { hours, minutes };
}

export function formatToMilitaryTime(hours: number, minutes: number) {
  const paddedHours = hours.toString().padStart(2, "0");
  const paddedMinutes = minutes.toString().padStart(2, "0");
  return `${paddedHours}:${paddedMinutes}`;
}

export async function errorHandlingFetch<T>(
  expectingOutput: T extends void ? false : true,
  input: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    if (json.error) {
      throw new Error(json.error);
    }
    throw new Error(`HTTP error: ${response.statusText}`);
  }
  if (expectingOutput && json === null) {
    throw new Error("Did not get response");
  }
  return json;
}
