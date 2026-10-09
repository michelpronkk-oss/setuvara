import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

let projectRef = "";
try {
  projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] ?? "";
} catch {
  projectRef = "";
}

const checks = {
  PROJECT: projectRef === "wizqtlgnuiicvpycvhhc",
  LIVE: process.env.DODO_PAYMENTS_ENVIRONMENT?.trim() === "live_mode",
  PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()),
};

for (const [name, passed] of Object.entries(checks)) {
  console.log(`${name}=${passed}`);
}

if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
