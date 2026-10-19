/**
 * The Admin Control Center is served only on its own host (admin.setuvara.com by default).
 * SETUVARA_ADMIN_HOSTS overrides the list, comma-separated, e.g. "admin.localhost" for local work.
 * Ports are ignored so a local server answers on admin.localhost:3014.
 */
const DEFAULT_ADMIN_HOSTS = ["admin.setuvara.com"];

function hostname(value: string) {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function adminHosts(): string[] {
  const configured = process.env.SETUVARA_ADMIN_HOSTS?.split(",").map(hostname).filter(Boolean);
  return configured?.length ? configured : DEFAULT_ADMIN_HOSTS;
}

export function isAdminHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return adminHosts().includes(hostname(host));
}

/** Internal route prefix the admin host is rewritten to. Never linked to directly. */
export const ADMIN_ROUTE_PREFIX = "/admin";
