/**
 * The public autocomplete endpoint accepts only positive decimal integers.
 * Keeping this separate from the route makes malformed inputs testable
 * without opening a database connection.
 *
 * null means the client did not send a limit. An invalid value returns null.
 */
export function parseAutocompleteLimit(raw: string | null): number | null {
  if (raw === null) return 6
  if (!/^[0-9]+$/.test(raw)) return null

  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null
  return Math.min(parsed, 20)
}
