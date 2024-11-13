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

function getTimeUntilNext(
  targetDay: number,
  targetHours: number,
  targetMinutes: number
) {
  const now = new Date();
  const nextDate = new Date();
  let daysUntilTarget = (targetDay - now.getDay() + 7) % 7;
  if (
    daysUntilTarget === 0 &&
    (now.getHours() > targetHours ||
      (now.getHours() === targetHours && now.getMinutes() >= targetMinutes))
  ) {
    daysUntilTarget = 7;
  }
  nextDate.setDate(now.getDate() + daysUntilTarget);
  nextDate.setHours(targetHours, targetMinutes, 0, 0);
  const duration = Number(nextDate) - Number(now);
  return duration;
}

function formatDuration(duration: number) {
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  const parts = [];
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  if (parts.length === 0) {
    return "less than a minute";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(", ")} and ${parts.slice(-1)}`;
}

function getTimeUntilNextTime(hours: number, minutes: number) {
  const now = new Date();
  const nextTime = new Date();
  nextTime.setHours(hours, minutes, 0, 0);
  if (now > nextTime) {
    nextTime.setDate(nextTime.getDate() + 1);
  }
  const duration = Number(nextTime) - Number(now);
  return duration;
}

export function formatAlarmSetToast(
  targetDays: number[],
  targetHours: number,
  targetMinutes: number
) {
  let durations: number[];
  if (targetDays.length === 0) {
    durations = [getTimeUntilNextTime(targetHours, targetMinutes)];
  } else {
    durations = targetDays.map((day) =>
      getTimeUntilNext(day, targetHours, targetMinutes)
    );
  }
  const clostestDuration = Math.min(...durations);
  const formatted = formatDuration(clostestDuration);
  return `Alarm set for ${formatted} from now`;
}
