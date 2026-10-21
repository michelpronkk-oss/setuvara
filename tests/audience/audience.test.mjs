/**
 * Audience: campaign email rendering, unsubscribe tokens and the Resend batch call.
 *
 *   npm run test:audience
 *
 * Bundles the pure helpers with esbuild; no database or network. Consent, quotas, leases and
 * unsubscribes are in supabase/tests/audience_core_security.sql.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-audience-"));
let mail, token, model;

before(async () => {
  const stub = join(out, "server-only.js");
  writeFileSync(stub, "");
  const bundle = async (entry, name) => {
    await build({ entryPoints: [join(root, entry)], bundle: true, format: "cjs", platform: "node", alias: { "@": join(root, "src"), "server-only": stub }, outfile: join(out, `${name}.cjs`), logLevel: "silent" });
    return createRequire(import.meta.url)(join(out, `${name}.cjs`));
  };
  process.env.AUDIENCE_UNSUBSCRIBE_SECRET = "test-secret-for-unsubscribe-links";
  [mail, token, model] = await Promise.all([bundle("src/lib/audience/mail.ts", "mail"), bundle("src/lib/audience/token.ts", "token"), bundle("src/lib/audience/model.ts", "model")]);
});
after(() => rmSync(out, { recursive: true, force: true }));

const base = { to: "reader@example.test", senderDisplay: "Aanya Rao", subject: "New work", preheader: "Three photos", body: "Hi,\n\nSee https://example.com/work.\n\nAanya", replyTo: null, lists: ["Letters"], unsubscribeUrl: "https://setuvara.com/api/audience/unsubscribe?t=abc" };

describe("campaign email", () => {
  test("owner text is escaped, never HTML", () => {
    const email = mail.renderCampaignEmail({ ...base, body: "<script>alert(1)</script>\n\n<b>hi</b>" });
    assert.ok(!email.html.includes("<script>"));
    assert.ok(email.html.includes("&lt;script&gt;"));
    assert.ok(!email.html.includes("<b>hi</b>"));
  });
  test("https links become links, trailing punctuation stays text", () => {
    const email = mail.renderCampaignEmail(base);
    assert.ok(email.html.includes('<a href="https://example.com/work"'));
    assert.ok(email.html.includes("</a>."));
  });
  test("javascript and http links are not linked", () => {
    const email = mail.renderCampaignEmail({ ...base, body: "javascript:alert(1) http://plain.example" });
    assert.ok(!email.html.includes("<a href=\"javascript"));
    assert.ok(!email.html.includes('<a href="http://'));
  });
  test("every email carries one-click unsubscribe and says why it was sent", () => {
    const email = mail.renderCampaignEmail(base);
    assert.equal(email.headers["List-Unsubscribe"], `<${base.unsubscribeUrl}>`);
    assert.equal(email.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.ok(email.text.includes("subscribed to Letters by Aanya Rao"));
    assert.ok(email.text.includes(base.unsubscribeUrl));
    assert.ok(email.html.includes(">Unsubscribe</a>"));
  });
  test("sender names can't inject headers", () => {
    assert.equal(mail.senderName('Eve" <evil@x.com>\r\nBcc: a@b.c'), "Eve evil x.com Bcc: a b.c via Setuvara");
    assert.equal(mail.senderName(""), "Setuvara");
    const email = mail.renderCampaignEmail({ ...base, subject: "Hi\r\nBcc: x@y.z" });
    assert.ok(!/[\r\n]/.test(email.subject));
  });
  test("tests are marked and reply-to is optional", () => {
    const email = mail.renderCampaignEmail({ ...base, test: true, replyTo: "me@example.test" });
    assert.ok(email.subject.startsWith("[Test] "));
    assert.equal(email.reply_to, "me@example.test");
    assert.equal("reply_to" in mail.renderCampaignEmail(base), false);
  });
  test("paragraphs split on blank lines only", () => {
    assert.deepEqual(model.campaignParagraphs("a\nb\n\n\n c \r\n\r\nd"), ["a\nb", "c", "d"]);
  });
});

describe("unsubscribe token", () => {
  const id = "0b6f5f8e-3c55-4a8f-9a40-5d2e1f8c7a11";
  test("round-trips", () => assert.equal(token.readUnsubscribe(token.signUnsubscribe(id)), id));
  test("an altered id or signature is refused", () => {
    const signed = token.signUnsubscribe(id);
    assert.equal(token.readUnsubscribe(signed.replace("0b6f", "1b6f")), null);
    assert.equal(token.readUnsubscribe(`${signed.slice(0, -1)}${signed.endsWith("A") ? "B" : "A"}`), null);
    assert.equal(token.readUnsubscribe(id), null);
    assert.equal(token.readUnsubscribe(null), null);
  });
});

describe("Resend batch", () => {
  const original = globalThis.fetch;
  after(() => { globalThis.fetch = original; });
  test("sends the batch key as the idempotency key", async () => {
    process.env.RESEND_API_KEY = "re_test";
    let seen;
    globalThis.fetch = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ data: [{ id: "e1" }] }), { status: 200 }); };
    const result = await mail.sendCampaignBatch([mail.renderCampaignEmail(base)], "audience-key-1");
    assert.deepEqual(result, { ok: true, ids: ["e1"] });
    assert.equal(seen.url, "https://api.resend.com/emails/batch");
    assert.equal(seen.init.headers["Idempotency-Key"], "audience-key-1");
  });
  test("rate limits retry, rejected payloads don't, lost requests are unknown", async () => {
    globalThis.fetch = async () => new Response("{}", { status: 429 });
    assert.deepEqual(await mail.sendCampaignBatch([], "k"), { ok: false, retry: true, error: "resend_429" });
    globalThis.fetch = async () => new Response("{}", { status: 422 });
    assert.deepEqual(await mail.sendCampaignBatch([], "k"), { ok: false, retry: false, error: "resend_422" });
    globalThis.fetch = async () => { throw new Error("socket hang up"); };
    assert.equal((await mail.sendCampaignBatch([], "k")).error, "network");
  });
});
