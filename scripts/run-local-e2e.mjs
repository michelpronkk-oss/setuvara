import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(process.cwd());
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
assert.equal(resolve(gitRoot), root, "Run local E2E from the Setuvara Git root");
assert.match(readFileSync(resolve(root, "supabase/config.toml"), "utf8"), /^project_id = "setuvara"$/m);

const status = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
const values = new Map(
  status
    .split(/\r?\n/)
    .map((line) => line.match(/^([^=]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const localUrl = values.get("API_URL");
const localPublishableKey = values.get("PUBLISHABLE_KEY");
assert(localUrl && new URL(localUrl).hostname === "127.0.0.1", "Supabase CLI must target local Setuvara only");
assert(localPublishableKey, "Local Supabase publishable key is missing");

const appUrl = "http://127.0.0.1:3014";
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: localUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localPublishableKey,
  PLAYWRIGHT_BROWSERS_PATH: resolve(root, ".playwright-browsers"),
  E2E_APP_URL: appUrl,
  E2E_MAILPIT_URL: "http://127.0.0.1:54324",
};

await new Promise((resolveReady, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(3014, "127.0.0.1", () => probe.close(resolveReady));
});

const build = spawn("npm", ["run", "build"], { cwd: root, env, stdio: "inherit", shell: true });
const buildCode = await new Promise((resolveCode, reject) => {
  build.once("error", reject);
  build.once("exit", (code) => resolveCode(code ?? 1));
});
assert.equal(buildCode, 0, "Production build using local Supabase settings must pass before E2E");

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3014"],
  { cwd: root, env, stdio: "ignore" },
);

let testCode = 1;
try {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Setuvara dev server exited before becoming ready");
    try {
      const response = await fetch(`${appUrl}/api/health/supabase`, { signal: AbortSignal.timeout(2_000) });
      if (response.status === 200) break;
    } catch {
      // Next.js may still be compiling or starting.
    }
    await delay(500);
  }

  const health = await fetch(`${appUrl}/api/health/supabase`, { signal: AbortSignal.timeout(3_000) });
  assert.equal(health.status, 200, "Setuvara health endpoint must reach local Supabase");
  assert.deepEqual(await health.json(), { status: "connected" });

  const runner = spawn(process.execPath, ["scripts/e2e-local-auth.mjs"], {
    cwd: root,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  testCode = await new Promise((resolveCode, reject) => {
    runner.once("error", reject);
    runner.once("exit", (code) => resolveCode(code ?? 1));
  });
} catch (error) {
  console.error(`Local E2E setup failed: ${error instanceof Error ? error.message : "unknown error"}`);
} finally {
  server.kill();
}

if (testCode === 0) {
  console.log("Local E2E runner completed successfully.");
} else {
  console.error("Local E2E failed; the dev server was stopped by the runner.");
  process.exitCode = testCode;
}
