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
