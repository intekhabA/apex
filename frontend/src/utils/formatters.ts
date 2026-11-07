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
 * Formats a date/timestamp with full date & time according to the lab's timezone.
 * Example output: "07 Nov 2026, 01:30 PM"
 */
export function formatDateTime(
  dateInput?: string | number | Date | null,
  options?: { timezone?: string; showSeconds?: boolean }
): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '—';
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
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '—';
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
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '—';
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
