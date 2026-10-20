import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.CHAT_TEST_APP_URL;
const dbUrl = process.env.CHAT_TEST_SUPABASE_URL;
const publishable = process.env.CHAT_TEST_PUBLISHABLE_KEY;
const secret = process.env.CHAT_TEST_SECRET_KEY;
const shots = process.env.CHAT_TEST_SHOTS;
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
  // A stored consent choice keeps the cookie panel from covering the composer.
  await context.addCookies([{ name: "sv-consent", value: "essential", url: appUrl }]);
  const page = await context.newPage();
  await page.goto(`${appUrl}/login`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/app/);
  return { context, page };
}

async function shot(page, name) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
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

  browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_CHROMIUM ?? undefined });
  const mobile = await signIn(alice, { width: 390, height: 844 });
  const desktop = await signIn(bob, { width: 1440, height: 900 });
  await mobile.page.goto(`${appUrl}/app/connections/messages?connection=${connection.id}`);
  await mobile.page.getByRole("textbox", { name: "First message" }).fill("Hello Bob from Alice");
  await mobile.page.getByRole("button", { name: "Send message" }).click();
  await mobile.page.getByText("Your message is waiting", { exact: false }).waitFor();
  await mobile.page.getByRole("listitem").filter({ hasText: "Today" }).first().waitFor();
  await noOverflow(mobile.page, "mobile request");
  await shot(mobile.page, "mobile-request-sent-390");

  await desktop.page.goto(`${appUrl}/app/connections`);
  await desktop.page.getByRole("link", { name: /, 1 unread message$/ }).first().waitFor({ timeout: 15000 });
  await desktop.page.getByRole("link", { name: /Messages\s*1\s*unread/ }).waitFor();
  await shot(desktop.page, "desktop-people-unread-1440");
  await desktop.page.goto(`${appUrl}/app/connections/messages`);
  await desktop.page.getByRole("button").filter({ hasText: "Hello Bob from Alice" }).click();
  await shot(desktop.page, "desktop-request-1440");
  await desktop.page.getByRole("button", { name: "Accept request" }).click();
  await desktop.page.getByRole("textbox", { name: "Message", exact: true }).fill("Hi Alice from Bob");
  await desktop.page.getByRole("button", { name: "Send message" }).click();
  await desktop.page.getByRole("list", { name: "Message history" }).getByText("Hi Alice from Bob").waitFor();
  await noOverflow(desktop.page, "desktop thread");
  await desktop.page.getByRole("link", { name: /, 1 unread message$/ }).first().waitFor({ state: "detached", timeout: 15000 });

  await mobile.page.getByRole("list", { name: "Message history" }).getByText("Hi Alice from Bob")
    .waitFor({ timeout: 15000 });
  // A burst of incoming messages keeps a reader who is at the bottom at the newest one.
  const bobClient = createClient(dbUrl, publishable, { auth: { persistSession: false } });
  assert.ifError((await bobClient.auth.signInWithPassword({ email: bob.email, password })).error);
  const { data: conversation } = await bobClient.from("chat_conversations").select("id").single();
  for (let index = 1; index <= 20; index += 1) {
    const sent = await bobClient.rpc("chat_send", { p_conversation_id: conversation.id, p_client_id: randomUUID(), p_body: `Line ${index} of a longer story` });
    assert.ifError(sent.error);
  }
  const newest = mobile.page.getByRole("list", { name: "Message history" }).getByText("Line 20 of a longer story");
  await newest.waitFor({ timeout: 15000 });
  await mobile.page.waitForTimeout(400);
  assert.ok(await newest.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight;
  }), "newest incoming message is scrolled into view");
  await shot(mobile.page, "mobile-thread-390");
  await desktop.page.getByRole("list", { name: "Message history" }).getByText("Line 20 of a longer story").waitFor();
  await shot(desktop.page, "desktop-thread-1440");

  // Switching conversations stays on the client: Back returns to the inbox without a reload.
  await mobile.page.getByRole("button", { name: "Back to inbox" }).click();
  await mobile.page.getByRole("button").filter({ hasText: "Line 20 of a longer story" }).waitFor();
  await shot(mobile.page, "mobile-inbox-390");
  await mobile.page.goBack();
  await mobile.page.getByRole("list", { name: "Message history" }).getByText("Hi Alice from Bob").waitFor();

  await mobile.page.getByRole("listitem").filter({ hasText: "Hi Alice from Bob" })
    .getByRole("button", { name: "Report" }).click();
  await mobile.page.getByRole("button", { name: "Send report" }).click();
  await mobile.page.getByText("Report received.").waitFor();

  // On phones the account-wide Privacy sheet lives on the inbox.
  await mobile.page.getByRole("button", { name: "Back to inbox" }).click();
  await mobile.page.getByRole("button", { name: "Privacy" }).click();
  await mobile.page.getByRole("switch", { name: "Allow message requests" }).click();
  await mobile.page.waitForFunction(() => document.querySelector('[aria-label="Allow message requests"]')?.getAttribute("aria-checked") === "false");
  await mobile.page.getByRole("button", { name: "Close privacy settings" }).click();
  await mobile.page.getByRole("button").filter({ hasText: "Line 20 of a longer story" }).click();
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
