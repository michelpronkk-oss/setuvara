import { readFile } from "node:fs/promises";
import DodoPayments from "dodopayments";

const requiredKeys = [
  "DODO_PAYMENTS_API_KEY",
  "DODO_PAYMENTS_ENVIRONMENT",
  "DODO_PLUS_MONTHLY_PRODUCT_ID",
  "DODO_PLUS_YEARLY_PRODUCT_ID",
  "DODO_PRO_MONTHLY_PRODUCT_ID",
  "DODO_PRO_YEARLY_PRODUCT_ID",
];

function parseEnvFile(source) {
  const parsed = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

const localEnv = parseEnvFile(await readFile(".env.local", "utf8"));
const env = Object.fromEntries(requiredKeys.map((key) => [key, process.env[key] || localEnv[key]]));
const missing = requiredKeys.filter((key) => !env[key]);
if (missing.length) {
  console.error(`Missing required server settings: ${missing.join(", ")}`);
  process.exit(1);
}
if (env.DODO_PAYMENTS_ENVIRONMENT !== "live_mode") {
  console.error("Read-only live validation refused: DODO_PAYMENTS_ENVIRONMENT must be exactly live_mode.");
  process.exit(1);
}

const products = [
  { label: "Plus Monthly", key: "DODO_PLUS_MONTHLY_PRODUCT_ID", amount: 699, interval: "Month" },
  { label: "Plus Yearly", key: "DODO_PLUS_YEARLY_PRODUCT_ID", amount: 6900, interval: "Year" },
  { label: "Pro Monthly", key: "DODO_PRO_MONTHLY_PRODUCT_ID", amount: 1299, interval: "Month" },
  { label: "Pro Yearly", key: "DODO_PRO_YEARLY_PRODUCT_ID", amount: 12900, interval: "Year" },
];

if (new Set(products.map(({ key }) => env[key])).size !== products.length) {
  console.error("Read-only live validation refused: configured product IDs must be four distinct IDs.");
  process.exit(1);
}

const client = new DodoPayments({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  environment: "live_mode",
  timeout: 12_000,
  maxRetries: 0,
  logLevel: "error",
});

let passed = true;
for (const expected of products) {
  try {
    const product = await client.products.retrieve(env[expected.key]);
    const price = product.price;
    const valid = product.product_id === env[expected.key] &&
      product.is_recurring &&
      price.type === "recurring_price" &&
      price.currency === "USD" &&
      price.price === expected.amount &&
      price.payment_frequency_count === 1 &&
      price.payment_frequency_interval === expected.interval &&
      price.subscription_period_count >= 20 &&
      price.subscription_period_interval === "Year" &&
      (!price.trial_period_days || price.trial_period_days === 0);
    console.log(`${expected.label}: ${valid ? "PASS" : "FAIL"} — actual ${price.currency} ${price.price} minor units; recurring=${product.is_recurring}; frequency=${price.payment_frequency_count} ${price.payment_frequency_interval}; subscription=${price.subscription_period_count} ${price.subscription_period_interval}; trial=${price.trial_period_days ?? 0} days`);
    passed &&= valid;
  } catch {
    console.error(`${expected.label}: LOOKUP_FAILED (provider details suppressed)`);
    passed = false;
  }
}

if (!passed) process.exit(1);
console.log("All four existing Dodo LIVE products match the required USD prices and recurring intervals.");
