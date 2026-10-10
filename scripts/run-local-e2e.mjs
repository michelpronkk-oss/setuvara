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
const supabaseCli = resolve(root, "node_modules/supabase/dist/supabase.js");
const runSupabase = (args) => execFileSync(process.execPath, [supabaseCli, ...args], { encoding: "utf8" });
const supabaseCliVersion = runSupabase(["--version"]).trim();
assert.equal(supabaseCliVersion, "2.120.0", "Setuvara local E2E requires its pinned Supabase CLI 2.120.0");

const status = runSupabase(["status", "-o", "env"]);
const values = new Map(
  status
    .split(/\r?\n/)
    .map((line) => line.match(/^([^=]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const localUrl = values.get("API_URL");
const localPublishableKey = values.get("PUBLISHABLE_KEY");
const localServiceRoleKey = values.get("SERVICE_ROLE_KEY");
assert(localUrl && new URL(localUrl).hostname === "127.0.0.1", "Supabase CLI must target local Setuvara only");
assert(localPublishableKey, "Local Supabase publishable key is missing");
assert(localServiceRoleKey, "Local Setuvara server key is required for billing reads and E2E fixture cleanup");

const appUrl = "http://127.0.0.1:3014";
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: localUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localPublishableKey,
  SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
  PLAYWRIGHT_BROWSERS_PATH: resolve(root, ".playwright-browsers"),
  E2E_APP_URL: appUrl,
  E2E_MAILPIT_URL: "http://127.0.0.1:54324",
};
const e2eEnv = { ...env, E2E_LOCAL_SERVICE_KEY: localServiceRoleKey };
const e2eScripts = ["scripts/e2e-marketing.mjs", "scripts/e2e-local-auth.mjs", "scripts/e2e-soundtrack.mjs", "scripts/e2e-connection-access.mjs"];
const requestedScript = process.env.E2E_LOCAL_SCRIPT;
assert(!requestedScript || e2eScripts.includes(requestedScript), "E2E_LOCAL_SCRIPT must name a Setuvara local E2E script");

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

  for (const script of requestedScript ? [requestedScript] : e2eScripts) {
    const runner = spawn(process.execPath, [script], {
      cwd: root,
      env: e2eEnv,
      stdio: ["ignore", "inherit", "inherit"],
    });
    testCode = await new Promise((resolveCode, reject) => {
      runner.once("error", reject);
      runner.once("exit", (code) => resolveCode(code ?? 1));
    });
    if (testCode !== 0) break;
  }
} catch (error) {
  console.error(`Local E2E setup failed: ${error instanceof Error ? error.message : "unknown error"}`);
} finally {
  if (process.platform === "win32" && server.pid) {
    await new Promise((resolveKill) => {
      const tree = spawn("taskkill.exe", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      tree.once("error", resolveKill);
      tree.once("exit", resolveKill);
    });
  } else {
    server.kill();
  }
}

if (testCode === 0) {
  console.log("Local E2E runner completed successfully.");
} else {
  console.error("Local E2E failed; the dev server was stopped by the runner.");
  process.exitCode = testCode;
}
