import { useAuthStore } from '@/store/authStore';

/**
 * Gets the active laboratory timezone configured by Super Admin.
 * Defaults to 'Asia/Kolkata' (India Standard Time).
 */
export function getAppTimezone(overrideTz?: string): string {
  if (overrideTz) return overrideTz;
  try {
    const user = useAuthStore.getState().user;
    if (user?.timezone) return user.timezone;
  } catch {
    // fallback if called outside react/store environment
  }
  return 'Asia/Kolkata';
}

/**
 * Safely parses any date/timestamp input into a Date object.
 * In this system, all database records are stored in UTC.
 * If an ISO date string is naive (lacks Z or offset), append 'Z' so JavaScript
 * correctly parses it as UTC instead of browser local time.
 */
export function parseDateInput(dateInput?: string | number | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  let s = String(dateInput).trim();
  if (!s) return null;
  // If ISO datetime without timezone designator (no 'Z' and no '+00:00'/'-05:00'), treat as UTC
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date/timestamp with full date & time according to the lab's timezone.
 * Example output: "07 Nov 2026, 01:30 PM"
 */
export function formatDateTime(
  dateInput?: string | number | Date | null,
  options?: { timezone?: string; showSeconds?: boolean }
): string {
  if (!dateInput) return '—';
  try {
    const d = parseDateInput(dateInput);
    if (!d) return '—';
    const tz = getAppTimezone(options?.timezone);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: options?.showSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a date according to the lab's timezone.
 * Example output: "07 Nov 2026"
 */
export function formatDate(
  dateInput?: string | number | Date | null,
  timezone?: string
): string {
  if (!dateInput) return '—';
  try {
    const d = parseDateInput(dateInput);
    if (!d) return '—';
    const tz = getAppTimezone(timezone);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a time according to the lab's timezone.
 * Example output: "01:30 PM"
 */
export function formatTime(
  dateInput?: string | number | Date | null,
  timezone?: string
): string {
  if (!dateInput) return '—';
  try {
    const d = parseDateInput(dateInput);
    if (!d) return '—';
    const tz = getAppTimezone(timezone);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a diagnostic result value for display.
 * - If the result is a whole number (non-floating / integer), display without decimals (no '.00').
 * - If the result is a float number, display with exactly 2 digits after decimal (e.g. '12.50').
 * - If non-numeric text (e.g. 'Positive', 'Negative'), display as is.
 */
export function formatResultValue(
  numericValue?: number | string | null,
  textValue?: string | null
): string {
  if (numericValue !== null && numericValue !== undefined && String(numericValue).trim() !== '') {
    const num = Number(numericValue);
    if (!isNaN(num)) {
      if (Number.isInteger(num)) {
        return String(num);
      }
      return num.toFixed(2);
    }
    return String(numericValue);
  }

  if (textValue !== null && textValue !== undefined && String(textValue).trim() !== '') {
    const trimmed = String(textValue).trim();
    const num = Number(trimmed);
    if (!isNaN(num)) {
      if (Number.isInteger(num)) {
        return String(num);
      }
      return num.toFixed(2);
    }
    return trimmed;
  }

  return '—';
}
