// Normalize gate — runs @packet-schema/core's normalize() in SEMANTIC view with
// a representative top-level budget injected, so it surfaces layout-time errors
// the validate-only gate (semcheck) cannot: encrypted-scope over-consumption
// (plaintext bits > wireBits, §5/§11.2), bounded-scope over-reads, etc.
//
// Why these options:
//  - viewMode: "semantic" — wire view treats encrypted regions as opaque and
//    never lays out the plaintext, so a plaintext-exceeds-wireBits bug is only
//    caught in semantic view.
//  - totalBits — many presets use `remaining`/`enclosingBits` at the top-level
//    body, which §10.1 requires the decoder to inject. We inject a large
//    representative budget so those resolve; any error that still throws is a
//    genuine modeling bug, not a missing-budget artifact.
//
// Usage: tsx scripts/normcheck.ts [presets/foo.psdl.yaml ...]   (default: all)

import { readdirSync, readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePsdl, normalize } from "@packet-schema/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(__dirname, "..", "presets");
// 1 MiB of bits — far larger than any preset's fixed content, so top-level
// `remaining`/`enclosingBits` resolve to a non-constraining budget.
const TOTAL_BITS = 1024 * 1024 * 8;

function main(): void {
  const argv = process.argv.slice(2);
  const files = argv.length > 0 ? argv : readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".psdl.yaml")).sort().map((f) => join(PRESETS_DIR, f));

  let failed = 0;
  for (const file of files) {
    const res = parsePsdl(readFileSync(file, "utf8"));
    if (!res.ok) {
      failed++;
      console.error(`✗ ${basename(file)} (parse): ${res.errors[0]}`);
      continue;
    }
    try {
      normalize(res.packet, new Map(), { viewMode: "semantic", totalBits: TOTAL_BITS });
    } catch (e) {
      failed++;
      console.error(`✗ ${basename(file)}\n    ${String((e as Error).message ?? e)}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} file(s) fail normalize (semantic).`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} file(s) normalize cleanly (semantic).`);
}

main();
