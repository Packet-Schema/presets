// Classification-vocabulary lint (catalog layer, PSDL 0.5 §1.1).
//
// Every preset's meta.tags / meta.family value must be registered in
// scripts/taxonomy.ts. PSDL leaves the vocabulary open; we close it here for
// catalog consistency. Also enforces a light shape rule: a tagged preset must
// carry exactly one layer tag. Exits non-zero on any violation.
//
// Usage: tsx scripts/taxcheck.ts [presets/foo.psdl.yaml ...]   (default: all)

import { readdirSync, readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { ALLOWED_TAGS, ALLOWED_FAMILIES } from "./taxonomy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(__dirname, "..", "presets");
const LAYER_TAGS = ["link-layer", "internet-layer", "transport", "application"];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function main(): void {
  const argv = process.argv.slice(2);
  const files = argv.length > 0 ? argv : readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".psdl.yaml")).sort().map((f) => join(PRESETS_DIR, f));

  let failed = 0;
  let tagged = 0;
  let untagged = 0;
  for (const file of files) {
    let raw: unknown;
    try { raw = parseYaml(readFileSync(file, "utf8")); } catch { continue; }
    const meta = isObj(raw) ? raw.meta : undefined;
    const errs: string[] = [];

    if (isObj(meta) && meta.tags !== undefined) {
      if (!Array.isArray(meta.tags)) {
        errs.push("meta.tags must be an array");
      } else {
        tagged++;
        for (const t of meta.tags) {
          if (typeof t === "string" && !ALLOWED_TAGS.has(t)) {
            errs.push(`unregistered tag "${t}" — register it in scripts/taxonomy.ts`);
          }
        }
        const layers = meta.tags.filter((t) => typeof t === "string" && LAYER_TAGS.includes(t));
        if (layers.length !== 1) {
          errs.push(`must carry exactly one layer tag (${LAYER_TAGS.join("|")}), found ${layers.length}`);
        }
      }
    } else {
      untagged++;
    }

    if (isObj(meta) && typeof meta.family === "string" && !ALLOWED_FAMILIES.has(meta.family)) {
      errs.push(`unregistered family "${meta.family}" — register it in scripts/taxonomy.ts`);
    }

    if (errs.length) {
      failed++;
      console.error(`✗ ${basename(file)}`);
      for (const e of errs) console.error(`    ${e}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} file(s) have classification violations.`);
    process.exit(1);
  }
  console.log(`Classification OK — ${tagged} tagged${untagged ? `, ${untagged} untagged` : ""}; vocabulary in scripts/taxonomy.ts.`);
}

main();
