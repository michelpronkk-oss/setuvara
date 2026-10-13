// Client-safe share id shapes. The server-only resolver re-exports these from mode-share.ts.
export const modeShortIdPattern = /^[0-9A-Za-z]{8}$/;
/** Short ids, plus the legacy 43-character tokens that must keep working. */
export const modeShareTokenPattern = /^(?:[0-9A-Za-z]{8}|[A-Za-z0-9_-]{43})$/;
