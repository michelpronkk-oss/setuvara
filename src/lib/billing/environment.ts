export type DodoEnvironment = "test_mode" | "live_mode";

/** Billing operations require an explicit provider mode aligned with the runtime. */
export function isDodoEnvironmentAllowed(
  environment: string | undefined,
  nodeEnvironment: string | undefined,
): environment is DodoEnvironment {
  if (nodeEnvironment === "production") return environment === "live_mode";
  return environment === "test_mode";
}
