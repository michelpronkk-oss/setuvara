/**
 * Public handles: the app's reserved list matches the database's, and every top-level route in
 * src/app is covered so no member can register a name that a page would hide.
 *
 *   npm run test:handles
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");
const source = readFileSync(join(root, "src/lib/usernames.ts"), "utf8");
const appList = [...source.slice(source.indexOf("reservedUsernames = ["), source.indexOf("] as const")).matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const pattern = /^[a-z0-9_]{3,24}$/;

function databaseList() {
  const dir = join(root, "supabase/migrations");
  const names = new Set();
  for (const file of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    for (const block of sql.matchAll(/insert into private\.reserved_handles \(handle\) values([\s\S]*?);/g)) {
      for (const match of block[1].matchAll(/\('([^']+)'\)/g)) names.add(match[1]);
    }
  }
  return names;
}

/** Top-level URL segments: folders and metadata files, with (groups) flattened. */
function topLevelSegments(dir = join(root, "src/app")) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (/^\(.+\)$/.test(entry.name)) out.push(...topLevelSegments(join(dir, entry.name)));
      else if (!entry.name.startsWith("[") && !entry.name.startsWith("_")) out.push(entry.name);
    } else if (/^(manifest|robots|sitemap|opengraph-image|icon|apple-icon)\.(ts|tsx)$/.test(entry.name)) {
      out.push(entry.name.replace(/\.(ts|tsx)$/, ""));
    }
  }
  return out;
}

test("app and database reserve the same names", () => {
  assert.deepEqual([...databaseList()].sort(), [...appList].sort());
});

test("every top-level route that looks like a username is reserved", () => {
  const reserved = new Set(appList);
  const open = topLevelSegments().filter((segment) => pattern.test(segment) && !reserved.has(segment));
  assert.deepEqual(open, [], `reserve these in the migration and src/lib/usernames.ts: ${open.join(", ")}`);
});

test("reserved names are lower-case", () => {
  for (const name of appList) assert.equal(name, name.toLowerCase());
});
