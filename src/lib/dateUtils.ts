/**
 * Date and Time utilities supporting explicit timezone calculations.
 */

// Format time string "HH:mm" to "hh:mm AM/PM"
export function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12; // '0' should be '12'
  const minutes = m < 10 ? `0${m}` : `${m}`;
  return `${h}:${minutes} ${ampm}`;
}

// Format a Date object in a specific timezone as YYYY-MM-DD
export function getDateInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

// Format a Date object in a specific timezone as HH:mm
export function getTimeInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

// Get the day of the week (0=Sunday, 1=Monday, ..., 6=Saturday) in a timezone
export function getDayOfWeekInTimezone(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const dayStr = formatter.format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[dayStr] ?? date.getDay();
}

/**
 * Creates an exact Date object representing a specific local date (YYYY-MM-DD)
 * and time (HH:mm) in a target timezone.
 */
export function createDateForTimezone(
  dateStr: string, // "YYYY-MM-DD"
  timeStr: string, // "HH:mm"
  timeZone: string
): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const [hourStr, minStr] = timeStr.split(":");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  // We can construct a Date by iterative offset search with Intl.DateTimeFormat
  // Initial guess: treat as UTC
  let target = new Date(Date.UTC(year, month - 1, day, hour, min, 0));

  // Refine using formatter in the target timezone
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  for (let i = 0; i < 3; i++) {
    const parts = dtf.formatToParts(target);
    const p: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        p[part.type] = parseInt(part.value, 10);
      }
    }
    // hour in formatToParts with hour12: false might return 24 for midnight in some Node versions
    const actualHour = (p.hour || 0) === 24 ? 0 : (p.hour || 0);

    const actualTimeAsUTC = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      actualHour,
      p.minute || 0,
      p.second || 0
    );
    const desiredTimeAsUTC = Date.UTC(year, month - 1, day, hour, min, 0);
    const diff = desiredTimeAsUTC - actualTimeAsUTC;
    if (diff === 0) break;
    target = new Date(target.getTime() + diff);
  }

  return target;
}

// Add days to a YYYY-MM-DD string
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const newY = dt.getUTCFullYear();
  const newM = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const newD = String(dt.getUTCDate()).padStart(2, "0");
  return `${newY}-${newM}-${newD}`;
}

// Format friendly date: "Saturday, November 21, 2026"
export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
