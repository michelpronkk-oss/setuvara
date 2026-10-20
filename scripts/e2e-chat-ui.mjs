import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.CHAT_TEST_APP_URL;
const dbUrl = process.env.CHAT_TEST_SUPABASE_URL;
const publishable = process.env.CHAT_TEST_PUBLISHABLE_KEY;
const secret = process.env.CHAT_TEST_SECRET_KEY;
const local = (value) => value && ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
if (process.env.CHAT_TEST_LOCAL !== "1" || !local(appUrl) || !local(dbUrl) || !publishable || !secret) {
  throw new Error("Chat browser E2E requires an explicitly configured local app and isolated local Supabase stack.");
}

const admin = createClient(dbUrl, secret, { auth: { persistSession: false } });
const enabled = await admin.rpc("chat_is_enabled");
assert.ifError(enabled.error);
assert.equal(enabled.data, true, "enable chat only in the isolated local test database first");
const run = randomUUID().slice(0, 8);
const password = `ChatBrowser-${randomUUID()}-aA1!`;
const userIds = [];
let browser;

async function member(name) {
  const email = `chat-ui-${name.toLowerCase()}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username: `chat_ui_${name.toLowerCase()}_${run}`, display_name: name },
  });
  assert.ifError(error);
  assert.ok(data.user?.id);
  userIds.push(data.user.id);
  return { id: data.user.id, name, email };
}

async function signIn(account, viewport) {
  const context = await browser.newContext({ viewport, locale: "en-GB" });
  const page = await context.newPage();
  await page.goto(`${appUrl}/login`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/app/);
  return { context, page };
}

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(size.scroll <= size.client + 1, `${label} has horizontal overflow`);
}

try {
  const alice = await member("Alice");
  const bob = await member("Bob");
  const { data: connection, error: connectionError } = await admin.from("connections").insert({
    user_id: alice.id, connected_user_id: bob.id,
    user_display_name_snapshot: alice.name, connected_display_name_snapshot: bob.name,
  }).select("id").single();
  assert.ifError(connectionError);

  browser = await chromium.launch({ headless: true });
  const mobile = await signIn(alice, { width: 390, height: 844 });
  const desktop = await signIn(bob, { width: 1440, height: 900 });
  await mobile.page.goto(`${appUrl}/app/connections/messages?connection=${connection.id}`);
  await mobile.page.getByRole("textbox", { name: "First message" }).fill("Hello Bob from Alice");
  await mobile.page.getByRole("button", { name: "Send message" }).click();
  await mobile.page.getByText("Your message is waiting", { exact: false }).waitFor();
  await noOverflow(mobile.page, "mobile request");

  await desktop.page.goto(`${appUrl}/app/connections/messages`);
  await desktop.page.getByRole("button").filter({ hasText: "Hello Bob from Alice" }).click();
  await desktop.page.getByRole("button", { name: "Accept request" }).click();
  await desktop.page.getByRole("textbox", { name: "Message", exact: true }).fill("Hi Alice from Bob");
  await desktop.page.getByRole("button", { name: "Send message" }).click();
  await desktop.page.getByRole("list", { name: "Message history" }).getByText("Hi Alice from Bob").waitFor();
  await noOverflow(desktop.page, "desktop thread");

  await mobile.page.getByRole("list", { name: "Message history" }).getByText("Hi Alice from Bob")
    .waitFor({ timeout: 15000 });
  await mobile.page.getByRole("listitem").filter({ hasText: "Hi Alice from Bob" })
    .getByRole("button", { name: "Report" }).click();
  await mobile.page.getByRole("button", { name: "Send report" }).click();
  await mobile.page.getByText("Report received.").waitFor();

  await mobile.page.getByRole("button", { name: "Privacy" }).click();
  await mobile.page.getByRole("switch", { name: "Allow message requests" }).click();
  await mobile.page.waitForFunction(() => document.querySelector('[aria-label="Allow message requests"]')?.getAttribute("aria-checked") === "false");
  await mobile.page.getByRole("button", { name: "Close privacy settings" }).click();
  await mobile.page.getByRole("button", { name: "Block", exact: true }).click();
  await mobile.page.getByRole("dialog", { name: /Block Bob/ }).getByRole("button", { name: "Block" }).click();
  await mobile.page.getByText("Messaging with this person is blocked.").waitFor();
  await noOverflow(mobile.page, "mobile blocked state");

  await mobile.context.close();
  await desktop.context.close();
  process.stdout.write("Connect Chat mobile and desktop browser E2E passed.\n");
} finally {
  await browser?.close();
  await Promise.allSettled(userIds.map((id) => admin.auth.admin.deleteUser(id)));
}
