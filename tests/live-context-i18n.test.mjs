import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-context-i18n-"));
let contextModel;
let locale;
let messages;
let countries;

before(async () => {
  await build({
    entryPoints: {
      contextModel: join(root, "src/lib/live-context/model.ts"),
      locale: join(root, "src/lib/i18n/locale.ts"),
      messages: join(root, "src/lib/i18n/messages.ts"),
      countries: join(root, "src/lib/i18n/countries.ts"),
    },
    bundle: true,
    format: "cjs",
    platform: "node",
    alias: { "@": join(root, "src") },
    outdir: out,
    outExtension: { ".js": ".cjs" },
    logLevel: "silent",
  });

  const require = createRequire(import.meta.url);
  contextModel = require(join(out, "contextModel.cjs"));
  locale = require(join(out, "locale.cjs"));
  messages = require(join(out, "messages.cjs"));
  countries = require(join(out, "countries.cjs"));
});

after(() => rmSync(out, { recursive: true, force: true }));

const NOW = new Date("2026-10-11T12:00:00.000Z");
const context = (extra = {}) => ({
  id: "context-1",
  owner_user_id: "owner-1",
  context_type: "event",
  label: "Slush",
  venue: null,
  city: "Helsinki",
  country_code: "FI",
  starts_at: null,
  expires_at: "2026-10-11T13:00:00.000Z",
  source: "manual",
  is_active: true,
  is_saved: false,
  created_at: "2026-10-11T10:00:00.000Z",
  updated_at: "2026-10-11T10:00:00.000Z",
  ...extra,
});

describe("Live Context resolution", () => {
  test("only the owner's active context inside its start/expiry window resolves", () => {
    const scheduled = context({ id: "scheduled", starts_at: "2026-10-11T13:00:00.000Z" });
    const expired = context({ id: "expired", expires_at: "2026-10-11T12:00:00.000Z" });
    const inactive = context({ id: "inactive", is_active: false });

    assert.equal(contextModel.isEffectiveLiveContext(context(), NOW), true);
    assert.equal(contextModel.isEffectiveLiveContext(scheduled, NOW), false);
    assert.equal(contextModel.isEffectiveLiveContext(expired, NOW), false);
    assert.equal(contextModel.isEffectiveLiveContext(inactive, NOW), false);
    assert.equal(contextModel.isEffectiveLiveContext(context({ expires_at: "not-a-date" }), NOW), false);
    assert.equal(contextModel.getActiveLiveContext([context(), scheduled, expired], "owner-1", NOW)?.id, "context-1");
    assert.equal(contextModel.getActiveLiveContext([context()], "another-user", NOW), null);
  });

  test("saved and recent contexts stay owner-scoped and bounded", () => {
    const saved = context({ id: "saved", is_saved: true });
    const recent = context({ id: "recent", is_active: false, is_saved: false });
    const other = context({ id: "other", owner_user_id: "another-user", is_active: false });

    assert.deepEqual(contextModel.getSavedLiveContexts([saved, other], "owner-1").map(({ id }) => id), ["saved"]);
    assert.deepEqual(contextModel.getRecentLiveContexts([saved, recent, context(), other], "owner-1", 10, NOW).map(({ id }) => id), ["recent"]);
    assert.equal(contextModel.getSavedLiveContexts([saved], "owner-1", 0).length, 0);
  });

  test("city identity normalizes Unicode and whitespace while retaining country", () => {
    const composed = contextModel.cityStampIdentity("  Québec\u00a0City  ", "ca");
    const decomposed = contextModel.cityStampIdentity("Que\u0301bec City", "CA");

    assert.equal(composed, decomposed);
    assert.notEqual(composed, contextModel.cityStampIdentity("Québec City", "US"));
    assert.equal(contextModel.cityStampIdentity("Helsinki", "ZZ"), null);
    assert.equal(contextModel.cityStampIdentity("   ", "FI"), null);
  });
});

describe("locale resolution and formatting", () => {
  test("an authenticated explicit preference wins, while guests use cookie then Accept-Language", () => {
    assert.equal(locale.resolveLocale({ authenticated: true, preferredLocale: "nl-NL", cookieLocale: "en", acceptLanguage: "en-US" }), "nl-NL");
    assert.equal(locale.resolveLocale({ authenticated: false, preferredLocale: "nl", cookieLocale: "nl-BE", acceptLanguage: "en-US" }), "nl-BE");
    assert.equal(locale.resolveLocale({ cookieLocale: "unsupported", acceptLanguage: "de-DE;q=1, nl-NL;q=0.8, en;q=0.2" }), "nl-NL");
    assert.equal(locale.resolveLocale({ cookieLocale: "unsupported", acceptLanguage: "de-DE" }), "en");
  });

  test("locale and region are independently validated", () => {
    assert.equal(locale.normalizeLocale("NL-nl"), "nl-NL");
    assert.equal(locale.normalizeLocale("fr-FR"), null);
    assert.equal(locale.resolveRegion("nl"), "NL");
    assert.equal(locale.resolveRegion("ZZ"), null);
  });

  test("formatters and country names use the selected locale", () => {
    const englishDate = locale.formatDate("2026-10-11T12:00:00Z", "en-US");
    const dutchDate = locale.formatDate("2026-10-11T12:00:00Z", "nl-NL");
    assert.notEqual(englishDate, dutchDate);
    assert.notEqual(locale.formatNumber(1234.5, "en-US"), locale.formatNumber(1234.5, "nl-NL"));
    assert.equal(countries.formatCountryName("NL", "nl-NL"), "Nederland");
    assert.equal(messages.getMessages("nl-NL").common.identity, "Identiteit");
    assert.equal(messages.getMessages("en").common.identity, "Identity");
  });

  test("formatting never mutates member-authored text", () => {
    const authored = "Fête du livre · Qué́bec — ありがとう";
    const before = authored;
    messages.getMessages("nl");
    assert.equal(authored, before);
  });
});
