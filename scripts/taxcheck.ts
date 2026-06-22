// Classification vocabulary lint: every preset's meta.tags / meta.family value
// must be registered in scripts/taxonomy.ts. This is the catalog-layer
// governance (core leaves the vocabulary open; we close it here). Exits non-zero
// on any unknown term, telling the author exactly which term to register.

import { readdirSync, readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { ALLOWED_TAGS, ALLOWED_FAMILIES } from "./taxonomy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(__dirname, "..", "presets");

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function main(): void {
  const argv = process.argv.slice(2);
  const files = argv.length > 0 ? argv : readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".psdl.yaml")).sort().map((f) => join(PRESETS_DIR, f));

  let failed = 0, tagged = 0;
  for (const file of files) {
    let raw: unknown;
    try { raw = parseYaml(readFileSync(file, "utf8")); } catch { continue; }
    if (!isObj(raw) || !isObj(raw.meta)) continue;
    const meta = raw.meta;
    const errs: string[] = [];
    if (meta.tags !== undefined) {
      if (!Array.isArray(meta.tags)) errs.push("meta.tags must be an array");
      else { tagged++; for (const t of meta.tags) if (typeof t === "string" && !ALLOWED_TAGS.has(t)) errs.push(`unregistered tag "${t}"`); }
    }
    if (typeof meta.family === "string" && !ALLOWED_FAMILIES.has(meta.family))
      errs.push(`unregistered family "${meta.family}"`);
    if (errs.length) {
      failed++;
      console.error(`✗ ${basename(file)}`);
      for (const e of errs) console.error(`    ${e} — register it in scripts/taxonomy.ts`);
    }
  }
  if (failed > 0) { console.error(`\n${failed} file(s) use unregistered classification terms.`); process.exit(1); }
  console.log(`Classification OK (${tagged} file(s) tagged; vocabulary governed by scripts/taxonomy.ts).`);
}
main();
